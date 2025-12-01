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

        // Update room with new state
        room.players = updatedState.players;
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

        // Notify all players of game state update
        room.players.forEach(player => {
          io.to(player.id).emit('game-update', {
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
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
