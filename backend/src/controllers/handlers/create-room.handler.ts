import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';

export class CreateRoomHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('create-room', async (data: { username: string; avatar: string }, callback) => {
      try {
        const room = await RoomService.createRoom(socket.id, data.username, data.avatar);
        
        socket.join(room.roomId);
        
        callback({ success: true, room });
        console.log(`🎮 Room created: ${room.roomId} by ${data.username}`);
      } catch (error) {
        console.error('Error creating room:', error);
        callback({ success: false, error: 'Failed to create room' });
      }
    });
  }
}
