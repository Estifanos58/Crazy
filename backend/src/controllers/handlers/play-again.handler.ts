import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { RoomService } from '../../services/room.service';

export class PlayAgainHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'play-again',
      async (
        data: { roomId: string; playerId?: string; playerToken?: string },
        callback
      ) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          const result = await GameOrchestrator.playAgain(
            data.roomId,
            socket.id,
            data.playerId,
            data.playerToken
          );

          if (!result.success || !result.room) {
            if (typeof callback === 'function') {
              callback({ success: false, error: result.error || 'Failed to start new game' });
            }
            return;
          }

          const updatedRoom = result.room;
          const sanitizedPlayers = RoomService.sanitizePlayers(updatedRoom.players);

          // Send private cards to each player
          updatedRoom.players.forEach(player => {
            const target = player.socketId || `player:${player.id}`;
            io.to(target).emit('game-started', {
              roomId: updatedRoom.roomId,
              players: sanitizedPlayers,
              currentTurn: updatedRoom.currentTurn,
              yourCards: player.cards,
              topCard: undefined,
              currentSuit: undefined,
              punishmentChain: updatedRoom.punishmentChain,
            });
          });

          if (typeof callback === 'function') {
            callback({ success: true });
          }
          console.log(`🔄 New game started in room: ${data.roomId}`);
        } catch (error) {
          console.error('Error starting new game:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
