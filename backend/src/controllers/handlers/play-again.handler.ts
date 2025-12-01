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

        // Get the previous game settings (or use defaults)
        const cardsPerPlayer = room.rules?.cardsPerPlayer || 7;
        const customRules = room.rules?.customRules;

        // Start a new game with same players and settings
        const updatedRoom = await RoomService.startGame({
          roomId: data.roomId,
          cardsPerPlayer,
          customRules,
          ruleConfig: room.ruleConfig,
        });
        
        if (!updatedRoom) {
          callback({ success: false, error: 'Failed to start new game' });
          return;
        }

        // Send private cards to each player (same as start-game handler)
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
            topCard: undefined,
            currentSuit: undefined,
            punishmentChain: updatedRoom.punishmentChain,
          });
        });

        callback({ success: true });
        console.log(`🔄 New game started in room: ${data.roomId}`);
      } catch (error) {
        console.error('Error starting new game:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
