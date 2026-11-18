import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { formatZodError, leaveGameSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

export class LeaveGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('leave-game', async (rawPayload: unknown, callback) => {
      try {
        const parsed = leaveGameSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const result = await GameOrchestrator.leaveGame(
          data.roomId,
          socket.id,
          Boolean(data.isCreator),
          data.playerId,
          data.playerToken
        );

        if (result.error) {
          if (typeof callback === 'function') {
            callback({ success: false, error: result.error });
          }
          return;
        }

        socket.leave(data.roomId);
        if (result.leavingPlayer) {
          socket.leave(`player:${result.leavingPlayer.id}`);
        }
        socket.data.roomId = undefined;
        socket.data.playerId = undefined;

        if (result.terminated) {
          io.to(data.roomId).emit('game-terminated', {
            message: 'Host has terminated the game',
          });
          logger.info('Room terminated', { roomId: data.roomId });
        } else if (result.leavingPlayer && result.room) {
          io.to(data.roomId).emit('player-left', {
            username: result.leavingPlayer.username,
            avatar: result.leavingPlayer.avatar,
            players: GameBroadcaster.sanitizePlayers(result.room.players),
            creatorId: result.room.creatorId,
          });

          result.events.forEach((event) => {
            io.to(data.roomId).emit('game-event', event);
          });

          GameOrchestrator.broadcastGameUpdate(result.room, io);
          logger.info('Player left room', {
            roomId: data.roomId,
            playerId: result.leavingPlayer.id,
            username: result.leavingPlayer.username,
          });
        }

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error handling leave game', {
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
