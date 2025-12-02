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

        // Apply card effects
        const { updatedState, events } = RuleService.applyCardEffects(
          gameState,
          socket.id,
          data.cards,
          data.chosenSuit
        );

        // Add blunder event if invalid move
        if (isBlunder) {
          events.push({
            type: 'invalid-move',
            payload: {
              playerId: socket.id,
              reason: validation.errors?.[0] || 'Invalid move',
              canBeChallenged: true,
              cards: data.cards,
            },
          });
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
