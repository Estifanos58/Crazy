import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';

export class ReconnectionHandler {
  static handle(socket: Socket, io: Server): void {
    // Rejoin room after reconnection
    socket.on('rejoin-room', async (data: { roomId: string; username: string; avatar: string }, callback) => {
      try {
        const room = await RoomService.rejoinRoom(socket.id, data.roomId, data.username, data.avatar);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        socket.join(room.roomId);
        
        io.to(room.roomId).emit('player-rejoined', {
          player: room.players.find(p => p.id === socket.id),
          players: room.players,
        });

        callback({ success: true, room });
        console.log(`🔄 ${data.username} rejoined room: ${data.roomId}`);
      } catch (error) {
        console.error('Error rejoining room:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });

    // Get current game state
    socket.on('get-game-state', async (data: { roomId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room || !room.gameStarted) {
          callback({ success: false, error: 'Game not found or not started' });
          return;
        }

        const player = room.players.find(p => p.id === socket.id);
        
        if (!player) {
          callback({ success: false, error: 'Player not in room' });
          return;
        }

        callback({
          success: true,
          gameState: {
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
            })),
            currentTurn: room.currentTurn,
            topCard: room.pile?.[room.pile.length - 1],
            currentSuit: room.currentSuit,
            yourCards: player.cards,
            punishmentChain: room.punishmentChain,
          },
        });
      } catch (error) {
        console.error('Error getting game state:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
