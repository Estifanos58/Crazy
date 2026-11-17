import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';

export class PunishmentHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'take-punishment',
      async (
        data: { roomId: string; playerId?: string; playerToken?: string },
        callback
      ) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          const result = await GameOrchestrator.takePunishment(
            data.roomId,
            socket.id,
            data.playerId,
            data.playerToken
          );

          if (!result.success) {
            if (typeof callback === 'function') {
              callback({ success: false, error: result.error });
            }
            return;
          }

          result.events.forEach(event => {
            io.to(data.roomId).emit('game-event', event);
          });

          if (result.room) {
            GameOrchestrator.broadcastGameUpdate(result.room, io);
          }

          if (typeof callback === 'function') {
            callback({ success: true });
          }
        } catch (error) {
          console.error('Error handling take punishment:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
