import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { GameOrchestrator } from '../../services/game.orchestrator';
import type { StartGameData } from '../../types/game.types';

export class StartGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'start-game',
      async (
        data: StartGameData & { playerId?: string; playerToken?: string },
        callback
      ) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          const room = await RoomService.getRoom(data.roomId);
          if (!room) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Room not found' });
            }
            return;
          }

          const player = GameOrchestrator.authenticatePlayer(
            room,
            socket.id,
            data.playerId,
            data.playerToken
          );

          if (!player) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Unauthorized' });
            }
            return;
          }

          // Strictly enforce host authorization!
          if (room.creatorId !== player.id) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Only room creator can start game' });
            }
            return;
          }

          if (room.players.length < 2) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'At least 2 players are required to start the game' });
            }
            return;
          }

          const updatedRoom = await RoomService.startGame(data);
          if (!updatedRoom) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Failed to start game' });
            }
            return;
          }

          const sanitizedPlayers = RoomService.sanitizePlayers(updatedRoom.players);

          // Send private hand to each player
          updatedRoom.players.forEach(p => {
            const target = p.socketId || `player:${p.id}`;
            io.to(target).emit('game-started', {
              roomId: updatedRoom.roomId,
              players: sanitizedPlayers,
              currentTurn: updatedRoom.currentTurn,
              yourCards: p.cards,
              topCard: undefined,
              currentSuit: undefined,
              punishmentChain: updatedRoom.punishmentChain,
            });
          });

          if (typeof callback === 'function') {
            callback({ success: true });
          }
          console.log(`🎮 Game started in room: ${data.roomId} by ${player.username}`);
        } catch (error) {
          console.error('Error starting game:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
