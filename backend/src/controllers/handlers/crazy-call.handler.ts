import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { GameState } from '../../types/game.types';

export class CrazyCallHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('call-crazy', async (data: { roomId: string; targetPlayerId: string }, callback) => {
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

        const { updatedState, events } = RuleService.applyIllegalTurnPenalty(
          gameState,
          data.targetPlayerId,
          socket.id
        );

        room.players = updatedState.players;
        room.deck = updatedState.deck;

        await RoomService.saveRoom(room);

        events.forEach(event => {
          io.to(room.roomId).emit('game-event', event);
        });

        callback({ success: true });
        console.log(`🚨 ${socket.id} called crazy on ${data.targetPlayerId}`);
      } catch (error) {
        console.error('Error calling crazy:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
