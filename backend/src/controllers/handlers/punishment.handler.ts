import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { GameState } from '../../types/game.types';

export class PunishmentHandler {
  static handle(socket: Socket, io: Server): void {
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

        const { updatedState, events } = RuleService.takePunishmentCards(gameState, socket.id);

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
        console.log(`📥 ${socket.id} took punishment cards in room ${data.roomId}`);
      } catch (error) {
        console.error('Error taking punishment:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
