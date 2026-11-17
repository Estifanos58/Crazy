import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';

export class NoRevertHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'no-revert',
      async (data: { roomId: string }, callback) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          // Trigger server-controlled blunder timeout
          await GameOrchestrator.handleBlunderTimeout(data.roomId, io);

          if (typeof callback === 'function') {
            callback({ success: true });
          }
        } catch (error) {
          console.error('Error handling no-revert:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
