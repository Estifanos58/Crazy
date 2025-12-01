import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';

export class LeaveGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('leave-game', async (data: { roomId: string; isCreator: boolean; username?: string; avatar?: string }) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          return;
        }

        if (data.isCreator) {
          // Creator is terminating the game - notify all players and delete room
          io.to(room.roomId).emit('game-terminated', {
            message: 'Host has terminated the game',
          });
          
          // Delete the room
          await RoomService.deleteRoom(data.roomId);
          console.log(`🗑️ Room ${data.roomId} terminated by creator`);
        } else {
          // Regular player is leaving - notify others
          const leavingPlayer = room.players.find(p => p.id === socket.id);
          
          if (leavingPlayer) {
            // Remove player from room
            room.players = room.players.filter(p => p.id !== socket.id);
            
            // If game has started and this was current turn, advance to next player
            if (room.gameStarted && room.currentTurn === socket.id && room.players.length > 0) {
              // Find next player in turn direction
              const turnDirection = room.turnDirection || 'clockwise';
              const direction = turnDirection === 'clockwise' ? 1 : -1;
              
              // Get next player
              if (room.players.length > 0) {
                room.currentTurn = room.players[0].id;
              }
            }
            
            await RoomService.saveRoom(room);
            
            // Notify remaining players
            io.to(room.roomId).emit('player-left', {
              username: leavingPlayer.username,
              avatar: leavingPlayer.avatar,
              players: room.players,
            });
            
            console.log(`👋 ${leavingPlayer.username} left room ${data.roomId}`);
          }
        }
      } catch (error) {
        console.error('Error handling leave game:', error);
      }
    });
  }
}
