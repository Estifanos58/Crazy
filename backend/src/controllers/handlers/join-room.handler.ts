import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { RateLimitService } from '../../services/rate-limit.service';
import { formatZodError, getRoomSchema, joinRoomSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

export class JoinRoomHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('join-room', async (rawPayload: unknown, callback) => {
      try {
        const ip = RateLimitService.getClientIp(socket);
        if (await RateLimitService.isBlocked('get-room-miss', ip)) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'Too many invalid room lookups. Please try again later.',
            });
          }
          return;
        }

        const parsed = joinRoomSchema.safeParse(rawPayload);
        if (!parsed.success) {
          metrics.inc('socket_validation_errors_total');
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const { roomId, username, avatar } = parsed.data;
        const result = await RoomService.joinRoom(socket.id, { roomId, username, avatar });

        if (!result) {
          await RateLimitService.consume('get-room-miss', ip);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found' });
          }
          return;
        }

        const { room, playerId, playerToken } = result;

        socket.data.roomId = room.roomId;
        socket.data.playerId = playerId;

        socket.join(room.roomId);
        socket.join(`player:${playerId}`);

        const sanitizedPlayers = GameBroadcaster.sanitizePlayers(room.players);
        const joiningPlayer = sanitizedPlayers.find((p) => p.id === playerId);

        io.to(room.roomId).emit('player-joined', {
          player: joiningPlayer,
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

        logger.info('Player joined room', { roomId: room.roomId, playerId, username });
      } catch (error) {
        logger.warn('Error joining room', {
          socketId: socket.id,
          error: error instanceof Error ? error : String(error),
        });
        if (typeof callback === 'function') {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    socket.on('get-room', async (rawRoomId: unknown, callback) => {
      try {
        const ip = RateLimitService.getClientIp(socket);
        if (await RateLimitService.isBlocked('get-room-miss', ip)) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'Too many invalid room lookups. Please try again later.',
            });
          }
          return;
        }

        const parsed = getRoomSchema.safeParse(rawRoomId);
        if (!parsed.success) {
          metrics.inc('socket_validation_errors_total');
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const room = await RoomService.getRoom(parsed.data);
        if (!room) {
          await RateLimitService.consume('get-room-miss', ip);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found' });
          }
          return;
        }

        if (typeof callback === 'function') {
          callback({ success: true, room: GameBroadcaster.buildPublicRoom(room) });
        }
      } catch (error) {
        logger.error('Error getting room', {
          socketId: socket.id,
          error: error instanceof Error ? error : String(error),
        });
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to get room' });
        }
      }
    });
  }
}
