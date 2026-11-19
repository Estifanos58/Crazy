import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { SessionAuthService } from '../../services/session-auth.service';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { RateLimitService } from '../../services/rate-limit.service';
import {
  formatZodError,
  rejoinRoomSchema,
  roomActionSchema,
} from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

export class ReconnectionHandler {
  static handle(socket: Socket, io: Server): void {
    // Rejoin room securely after reconnection
    socket.on('rejoin-room', async (rawPayload: unknown, callback) => {
      const ip = RateLimitService.getClientIp(socket);

      try {
        if (await RateLimitService.isBlocked('rejoin-auth-fail', ip)) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'Too many failed reconnection attempts. Please try again later.',
            });
          }
          return;
        }

        const parsed = rejoinRoomSchema.safeParse(rawPayload);
        if (!parsed.success) {
          metrics.inc('socket_validation_errors_total');
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const result = await RoomService.rejoinRoom(
          socket.id,
          data.roomId,
          data.playerId,
          data.playerToken,
          data.username,
          data.avatar
        );

        if (!result) {
          await RateLimitService.consume('rejoin-auth-fail', ip);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found' });
          }
          return;
        }

        const { room, player, playerId, playerToken } = result;

        socket.data.roomId = room.roomId;
        socket.data.playerId = playerId;

        socket.join(room.roomId);
        socket.join(`player:${playerId}`);

        const sanitizedPlayers = GameBroadcaster.sanitizePlayers(room.players);
        const sanitizedRejoiningPlayer =
          sanitizedPlayers.find((p) => p.id === playerId) ||
          GameBroadcaster.sanitizePlayers([player])[0];

        io.to(room.roomId).emit('player-rejoined', {
          player: sanitizedRejoiningPlayer,
          players: sanitizedPlayers,
        });

        const publicRoom = GameBroadcaster.buildPublicRoom(room);

        if (typeof callback === 'function') {
          callback({
            success: true,
            room: publicRoom,
            playerId,
            playerToken,
          });
        }

        logger.info('Player rejoined room', {
          roomId: room.roomId,
          playerId,
          username: player.username,
        });
      } catch (error) {
        await RateLimitService.consume('rejoin-auth-fail', ip);
        logger.warn('Error rejoining room', {
          socketId: socket.id,
          ip,
          error: error instanceof Error ? error : String(error),
        });
        if (typeof callback === 'function') {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    // Get current authoritative game state (works for both active and finished games)
    socket.on('get-game-state', async (rawPayload: unknown, callback) => {
      try {
        const parsed = roomActionSchema.safeParse(rawPayload);
        if (!parsed.success) {
          metrics.inc('socket_validation_errors_total');
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const data = parsed.data;
        const room = await RoomService.getRoom(data.roomId);
        if (!room || (!room.gameStarted && !room.gameOver)) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Game not found or not started' });
          }
          return;
        }

        const player = SessionAuthService.authenticatePlayer(
          room,
          socket.id,
          data.playerId,
          data.playerToken
        );

        if (!player) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Unauthorized or player not in room' });
          }
          return;
        }

        const gameState = GameBroadcaster.buildGameStateResponse(room, player);

        if (typeof callback === 'function') {
          callback({
            success: true,
            gameState,
          });
        }
      } catch (error) {
        logger.error('Error getting game state', {
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
