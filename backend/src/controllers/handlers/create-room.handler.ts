import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { GameBroadcaster } from '../../services/game-broadcaster.service';
import { createRoomSchema, formatZodError } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

export class CreateRoomHandler {
  static handle(socket: Socket, _io: Server): void {
    socket.on('create-room', async (rawPayload: unknown, callback) => {
      try {
        const parsed = createRoomSchema.safeParse(rawPayload);
        if (!parsed.success) {
          if (typeof callback === 'function') {
            callback({ success: false, error: formatZodError(parsed.error) });
          }
          return;
        }

        const { username, avatar } = parsed.data;
        const { room, playerId, playerToken } = await RoomService.createRoom(
          socket.id,
          username,
          avatar
        );

        socket.data.roomId = room.roomId;
        socket.data.playerId = playerId;

        socket.join(room.roomId);
        socket.join(`player:${playerId}`);

        const publicRoom = GameBroadcaster.buildPublicRoom(room);

        if (typeof callback === 'function') {
          callback({
            success: true,
            roomId: room.roomId,
            room: publicRoom,
            playerId,
            playerToken,
          });
        }

        logger.info('Room created', { roomId: room.roomId, playerId, username });
      } catch (error) {
        logger.error('Error creating room', {
          socketId: socket.id,
          error: error instanceof Error ? error : String(error),
        });
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to create room' });
        }
      }
    });
  }
}
