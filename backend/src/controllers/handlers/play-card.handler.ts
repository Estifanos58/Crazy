import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { Card, Suit, GameState, GameEvent } from '../../types/game.types';

export class PlayCardHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('play-card', async (data: { roomId: string; cards: Card[]; chosenSuit?: Suit }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        // Convert room to game state
        const gameState: GameState = {
          roomId: room.roomId,
          players: room.players,
          deck: room.deck,
          pile: room.pile || [],
          currentTurn: room.currentTurn!,
          currentSuit: room.currentSuit || data.cards[0].suit,
          turnDirection: room.turnDirection || 'clockwise',
          punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
          ruleConfig: room.ruleConfig,
          gameStarted: room.gameStarted,
          gameEnded: false,
        };

        let newGameState: GameState = gameState;
        let gameEvent: GameEvent[]  = [];

        // Validate move (but allow blunders)
        const validation = RuleService.validateMove(gameState, socket.id, data.cards);
        const isBlunder = !validation.valid && validation.canChallengeCrazy;

        // Create blunder state if invalid move
        if (isBlunder) {
          const ruleConfig = RuleService.mergeConfig(room.ruleConfig);
          
          // Create blunder state - DO NOT modify game state
          room.blunderState = {
            active: true,
            playerId: socket.id,
            cards: data.cards,
            penalty: ruleConfig.crazyChallenge.penalty,
            timestamp: Date.now(),
          };

          // Save room with blunderState only
          await RoomService.saveRoom(room);

          // Add blunder event
          gameEvent.push({
            type: 'invalid-move',
            payload: {
              playerId: socket.id,
              reason: validation.errors?.[0] || 'Invalid move',
              canBeChallenged: true,
              cards: data.cards,
            },
          });

          // Emit blunder event immediately
          gameEvent.forEach(event => {
            io.to(room.roomId).emit('game-event', event);
          });

          callback({ success: true, isBlunder: true });
          console.log(`⚠️ ${socket.id} made a blunder in room ${data.roomId} - waiting for revert or timeout`);
          return; // CRITICAL: Stop here, don't modify game state
        } else {
          // Clear any existing blunder state on valid move
          room.blunderState = {
            active: false,
            playerId: '',
            cards: [],
            penalty: 0,
            timestamp: 0,
          };
        }

        // Apply card effects (only for valid moves)
        const { updatedState, events } = RuleService.applyCardEffects(
          gameState,
          socket.id,
          data.cards,
          data.chosenSuit,
          data.cards.length > 1 // multipleCards flag
        );

        newGameState = updatedState;
        events.forEach(event => {
          gameEvent.push(event)
        })



        // Check if any player finished (ran out of cards)
        const finishedPlayer = newGameState.players.find(p => p.cards.length === 0);
        
        if (finishedPlayer && !room.finishedPlayers) {
          room.finishedPlayers = [];
        }

        if (finishedPlayer) {
          // Calculate rank (1st, 2nd, 3rd, etc.)
          const rank = (room.finishedPlayers?.length || 0) + 1;
          finishedPlayer.rank = rank;
          finishedPlayer.finishedAt = Date.now();
          
          // IMPORTANT: Before removing the finished player, ensure turn advances to NEXT player
          // The finished player's turn should pass to the next player in sequence
          const currentIndex = newGameState.players.findIndex(p => p.id === finishedPlayer.id);
          const direction = newGameState.turnDirection === 'clockwise' ? 1 : -1;
          const nextIndex = (currentIndex + direction + newGameState.players.length) % newGameState.players.length;
          
          // Find next active player (who still has cards, excluding the finished player)
          let nextPlayerIndex = nextIndex;
          let attempts = 0;
          while (attempts < newGameState.players.length) {
            const potentialNextPlayer = newGameState.players[nextPlayerIndex];
            if (potentialNextPlayer.id !== finishedPlayer.id && potentialNextPlayer.cards.length > 0) {
              newGameState.currentTurn = potentialNextPlayer.id;
              break;
            }
            nextPlayerIndex = (nextPlayerIndex + direction + newGameState.players.length) % newGameState.players.length;
            attempts++;
          }
          
          // Move player from active players to finished players
          room.players = newGameState.players.filter(p => p.id !== finishedPlayer.id);
          room.finishedPlayers!.push(finishedPlayer);
          
          // Emit player-finished event
          gameEvent.push({
            type: 'player-finished',
            payload: {
              playerId: finishedPlayer.id,
              playerName: finishedPlayer.username,
              rank: rank,
            },
          });
          
          console.log(`🏁 ${finishedPlayer.username} finished in position ${rank}`);
        } else {
          // Update room with new state (no finished players)
          room.players = newGameState.players;
        }

        room.deck = newGameState.deck;
        room.pile = newGameState.pile;
        room.currentTurn = newGameState.currentTurn;
        room.currentSuit = newGameState.currentSuit;
        room.turnDirection = newGameState.turnDirection;
        room.punishmentChain = newGameState.punishmentChain;
        room.lastSuitChangedBy = newGameState.lastSuitChangedBy; // Track consecutive suit changes
        room.drawCount = 0; // Reset draw count when a card is played

        await RoomService.saveRoom(room);

        // Broadcast gameEvent to all players
        gameEvent.forEach(event => {
          io.to(room.roomId).emit('game-event', event);
        });

        // Notify all players (both active and finished) of game state update
        const allPlayers = [...room.players, ...(room.finishedPlayers || [])];
        allPlayers.forEach(player => {
          io.to(player.id).emit('game-update', {
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
            })),
            finishedPlayers: (room.finishedPlayers || []).map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              rank: p.rank,
            })),
            currentTurn: room.currentTurn,
            topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined,
            currentSuit: room.currentSuit,
            yourCards: player.cards,
            punishmentChain: room.punishmentChain,
          });
        });

        callback({ success: true });
        console.log(`🎴 ${socket.id} played ${data.cards.length} card(s) in room ${data.roomId}`);
      } catch (error) {
        console.error('Error playing card:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
