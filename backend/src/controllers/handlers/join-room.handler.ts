import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { JoinRoomData } from '../../types/game.types';

export class JoinRoomHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('join-room', async (data: JoinRoomData, callback) => {
      try {
        const room = await RoomService.joinRoom(socket.id, data);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        socket.join(room.roomId);
        
        io.to(room.roomId).emit('player-joined', {
          player: room.players.find(p => p.id === socket.id),
          players: room.players,
        });

        callback({ success: true, room });
        console.log(`👤 ${data.username} joined room: ${data.roomId}`);
      } catch (error) {
        console.error('Error joining room:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('get-room', async (roomId: string, callback) => {
      try {
        const room = await RoomService.getRoom(roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        callback({ success: true, room });
      } catch (error) {
        console.error('Error getting room:', error);
        callback({ success: false, error: 'Failed to get room' });
      }
    });
  }
}
