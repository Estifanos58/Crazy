import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { formatZodError, roomActionSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

export class CrazyCallHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('call-crazy', async (rawPayload: unknown, callback) => {
      try {
        const parsed = roomActionSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const result = await GameOrchestrator.callCrazy(
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

        result.events.forEach((event) => {
          io.to(data.roomId).emit('game-event', event);
        });

        if (result.room) {
          GameOrchestrator.broadcastGameUpdate(result.room, io);
        }

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error handling crazy call', {
          socketId: socket.id,
          error: error instanceof Error ? error : String(error),
        });
        if (typeof callback === 'function') {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });
  }
}
