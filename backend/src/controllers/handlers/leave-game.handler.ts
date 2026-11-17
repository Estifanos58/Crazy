import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import { RoomService } from '../../services/room.service';

export class LeaveGameHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'leave-game',
      async (data: {
        roomId: string;
        isCreator?: boolean;
        playerId?: string;
        playerToken?: string;
        username?: string;
        avatar?: string;
      }) => {
        try {
          if (!data || !data.roomId) return;

          const result = await GameOrchestrator.leaveGame(
            data.roomId,
            socket.id,
            Boolean(data.isCreator),
            data.playerId,
            data.playerToken
          );

          if (result.terminated) {
            io.to(data.roomId).emit('game-terminated', {
              message: 'Host has terminated the game',
            });
            console.log(`🗑️ Room ${data.roomId} terminated by host`);
          } else if (result.leavingPlayer && result.room) {
            io.to(data.roomId).emit('player-left', {
              username: result.leavingPlayer.username,
              avatar: result.leavingPlayer.avatar,
              players: RoomService.sanitizePlayers(result.room.players),
            });

            GameOrchestrator.broadcastGameUpdate(result.room, io);
            console.log(`👋 ${result.leavingPlayer.username} left room ${data.roomId}`);
          }
        } catch (error) {
          console.error('Error handling leave game:', error);
        }
      }
    );
  }
}
