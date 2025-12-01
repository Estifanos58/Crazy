import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { GameState } from '../../types/game.types';

export class PunishmentHandler {
  static handle(socket: Socket, io: Server): void {
    // Handle taking punishment or drawing a single card
    socket.on('take-punishment', async (data: { roomId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        const gameState: GameState = {
          roomId: room.roomId,
          players: room.players,
          deck: room.deck,
          pile: room.pile || [],
          currentTurn: room.currentTurn!,
          currentSuit: room.currentSuit!,
          turnDirection: room.turnDirection || 'clockwise',
          punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
          ruleConfig: room.ruleConfig,
          gameStarted: room.gameStarted,
          gameEnded: false,
        };

        let events;
        let updatedState;

        // Check if there's an active punishment chain
        if (gameState.punishmentChain.active && gameState.punishmentChain.amount > 0) {
          // Take punishment cards
          const result = RuleService.takePunishmentCards(gameState, socket.id);
          updatedState = result.updatedState;
          events = result.events;
        } else {
          // Draw a single card when no playable card
          const result = RuleService.drawSingleCard(gameState, socket.id);
          updatedState = result.updatedState;
          events = result.events;
        }

        room.players = updatedState.players;
        room.deck = updatedState.deck;
        room.currentTurn = updatedState.currentTurn;
        room.punishmentChain = updatedState.punishmentChain;

        await RoomService.saveRoom(room);

        events.forEach(event => {
          io.to(room.roomId).emit('game-event', event);
        });

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
        
        if (gameState.punishmentChain.active) {
          console.log(`📥 ${socket.id} took ${gameState.punishmentChain.amount} punishment cards in room ${data.roomId}`);
        } else {
          console.log(`🎴 ${socket.id} drew 1 card in room ${data.roomId}`);
        }
      } catch (error) {
        console.error('Error taking punishment/drawing card:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
