import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';

export class CreateRoomHandler {
  static handle(socket: Socket, _io: Server): void {
    socket.on('create-room', async (data: { username: string; avatar: string }, callback) => {
      try {
        if (!data || !data.username || typeof data.username !== 'string' || !data.avatar) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid username or avatar' });
          }
          return;
        }

        const username = data.username.trim();
        if (username.length < 1 || username.length > 30) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Username must be between 1 and 30 characters' });
          }
          return;
        }

        const { room, playerId, playerToken } = await RoomService.createRoom(
          socket.id,
          username,
          data.avatar
        );
        
        socket.join(room.roomId);
        socket.join(`player:${playerId}`);
        
        const publicRoom = {
          roomId: room.roomId,
          creatorId: room.creatorId,
          players: RoomService.sanitizePlayers(room.players),
          gameStarted: room.gameStarted,
          createdAt: room.createdAt,
        };

        if (typeof callback === 'function') {
          callback({
            success: true,
            room: publicRoom,
            playerId,
            playerToken,
          });
        }
        console.log(`🎮 Room created: ${room.roomId} by ${username} (${playerId})`);
      } catch (error) {
        console.error('Error creating room:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to create room' });
        }
      }
    });
  }
}
