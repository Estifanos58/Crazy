import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { StartGameData } from '../../types/game.types';

export class StartGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('start-game', async (data: StartGameData, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        if (room.creatorId !== socket.id) {
          callback({ success: false, error: 'Only room creator can start game' });
          return;
        }

        const updatedRoom = await RoomService.startGame(data);
        
        if (!updatedRoom) {
          callback({ success: false, error: 'Failed to start game' });
          return;
        }

        // Send private cards to each player
        updatedRoom.players.forEach(player => {
          io.to(player.id).emit('game-started', {
            roomId: updatedRoom.roomId,
            players: updatedRoom.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
            })),
            currentTurn: updatedRoom.currentTurn,
            yourCards: player.cards,
          });
        });

        callback({ success: true });
        console.log(`🎮 Game started in room: ${data.roomId}`);
      } catch (error) {
        console.error('Error starting game:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
