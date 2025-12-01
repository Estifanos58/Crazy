import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';

export class PlayAgainHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('play-again', async (data: { roomId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        // Reset the game state while keeping players and room info
        const resetRoom = await RoomService.resetGame(room);
        
        if (!resetRoom) {
          callback({ success: false, error: 'Failed to reset game' });
          return;
        }

        // Notify all players that the game has been reset
        io.to(data.roomId).emit('game-reset', {
          roomId: resetRoom.roomId,
          players: resetRoom.players.map(p => ({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            cardCount: 0,
          })),
        });

        callback({ success: true });
        console.log(`🔄 Game reset in room: ${data.roomId}`);
      } catch (error) {
        console.error('Error resetting game:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
