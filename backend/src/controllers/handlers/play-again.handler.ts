import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { formatZodError, roomActionSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

export class PlayAgainHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('play-again', async (rawPayload: unknown, callback) => {
      try {
        const parsed = roomActionSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const result = await GameOrchestrator.playAgain(
          data.roomId,
          socket.id,
          data.playerId,
          data.playerToken
        );

        if (!result.success || !result.room) {
          if (typeof callback === 'function') {
            callback({ success: false, error: result.error || 'Failed to start new game' });
          }
          return;
        }

        GameBroadcaster.broadcastGameStarted(result.room, io);

        if (typeof callback === 'function') {
          callback({ success: true });
        }
        logger.info('New game started via play-again', { roomId: data.roomId });
      } catch (error) {
        logger.error('Error starting new game', {
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
