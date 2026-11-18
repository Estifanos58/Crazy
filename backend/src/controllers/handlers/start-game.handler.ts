import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { formatZodError, startGameSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';
import type { RuleConfig } from '../../types/game.types';

export class StartGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('start-game', async (rawPayload: unknown, callback) => {
      try {
        const parsed = startGameSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const { room, starter } = await RoomService.startGameAuthorized(socket.id, {
          roomId: data.roomId,
          playerId: data.playerId,
          playerToken: data.playerToken,
          cardsPerPlayer: data.cardsPerPlayer,
          customRules: data.customRules,
          rulePreset: data.rulePreset,
          ruleConfig: data.ruleConfig as Partial<RuleConfig> | undefined,
        });

        GameBroadcaster.broadcastGameStarted(room, io);

        if (typeof callback === 'function') {
          callback({ success: true });
        }

        logger.info('Game started', {
          roomId: room.roomId,
          startedBy: starter.id,
          playerCount: room.players.length,
          cardsPerPlayer: room.rules?.cardsPerPlayer,
        });
      } catch (error) {
        logger.warn('Error starting game', {
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
