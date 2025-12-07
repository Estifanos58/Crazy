import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { Card, Suit, GameState } from '../../types/game.types';

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

        // Validate move (but allow blunders)
        const validation = RuleService.validateMove(gameState, socket.id, data.cards);
        const isBlunder = !validation.valid && validation.canChallengeCrazy;

        // Apply card effects (pass multiple cards flag)
        const { updatedState, events } = RuleService.applyCardEffects(
          gameState,
          socket.id,
          data.cards,
          data.chosenSuit,
          data.cards.length > 1 // multipleCards flag
        );

        // Create blunder state if invalid move
        if (isBlunder) {
          const ruleConfig = RuleService.mergeConfig(room.ruleConfig);
          
          // Create blunder state
          room.blunderState = {
            active: true,
            playerId: socket.id,
            cards: data.cards,
            penalty: ruleConfig.crazyChallenge.penalty,
            timestamp: Date.now(),
          };

          // Add blunder event
          events.push({
            type: 'invalid-move',
            payload: {
              playerId: socket.id,
              reason: validation.errors?.[0] || 'Invalid move',
              canBeChallenged: true,
              cards: data.cards,
            },
          });

          // CRITICAL: On blunder, do NOT update the game state turn
          // Keep the current player's turn so they can revert or face penalty
          updatedState.currentTurn = socket.id;
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

        // Check if any player finished (ran out of cards)
        const finishedPlayer = updatedState.players.find(p => p.cards.length === 0);
        
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
          const currentIndex = updatedState.players.findIndex(p => p.id === finishedPlayer.id);
          const direction = updatedState.turnDirection === 'clockwise' ? 1 : -1;
          const nextIndex = (currentIndex + direction + updatedState.players.length) % updatedState.players.length;
          
          // Find next active player (who still has cards, excluding the finished player)
          let nextPlayerIndex = nextIndex;
          let attempts = 0;
          while (attempts < updatedState.players.length) {
            const potentialNextPlayer = updatedState.players[nextPlayerIndex];
            if (potentialNextPlayer.id !== finishedPlayer.id && potentialNextPlayer.cards.length > 0) {
              updatedState.currentTurn = potentialNextPlayer.id;
              break;
            }
            nextPlayerIndex = (nextPlayerIndex + direction + updatedState.players.length) % updatedState.players.length;
            attempts++;
          }
          
          // Move player from active players to finished players
          room.players = updatedState.players.filter(p => p.id !== finishedPlayer.id);
          room.finishedPlayers!.push(finishedPlayer);
          
          // Emit player-finished event
          events.push({
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
          room.players = updatedState.players;
        }

        room.deck = updatedState.deck;
        room.pile = updatedState.pile;
        room.currentTurn = updatedState.currentTurn;
        room.currentSuit = updatedState.currentSuit;
        room.turnDirection = updatedState.turnDirection;
        room.punishmentChain = updatedState.punishmentChain;
        room.lastSuitChangedBy = updatedState.lastSuitChangedBy; // Track consecutive suit changes
        room.drawCount = 0; // Reset draw count when a card is played

        await RoomService.saveRoom(room);

        // Broadcast events to all players
        events.forEach(event => {
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
