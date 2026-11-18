import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { formatZodError, playCardSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

export class PlayCardHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('play-card', async (rawPayload: unknown, callback) => {
      try {
        const parsed = playCardSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const result = await GameOrchestrator.playCard(
          data.roomId,
          socket.id,
          data.cards,
          data.chosenSuit,
          data.playerId,
          data.playerToken,
          io
        );

        if (!result.success && !result.isBlunder) {
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
          callback({
            success: true,
            isBlunder: result.isBlunder,
          });
        }
      } catch (error) {
        logger.error('Error playing card', {
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
