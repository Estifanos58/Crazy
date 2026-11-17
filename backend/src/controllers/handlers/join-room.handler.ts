import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { JoinRoomData } from '../../types/game.types';

export class JoinRoomHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('join-room', async (data: JoinRoomData, callback) => {
      try {
        if (!data || !data.roomId || !data.username) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid room ID or username' });
          }
          return;
        }

        const username = data.username.trim();
        const result = await RoomService.joinRoom(socket.id, {
          ...data,
          username,
        });
        
        if (!result) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found' });
          }
          return;
        }

        const { room, playerId, playerToken } = result;

        socket.join(room.roomId);
        socket.join(`player:${playerId}`);
        
        const sanitizedPlayers = RoomService.sanitizePlayers(room.players);
        const joiningPlayer = sanitizedPlayers.find(p => p.id === playerId);

        io.to(room.roomId).emit('player-joined', {
          player: joiningPlayer,
          players: sanitizedPlayers,
        });

        const publicRoom = {
          roomId: room.roomId,
          creatorId: room.creatorId,
          players: sanitizedPlayers,
          gameStarted: room.gameStarted,
          createdAt: room.createdAt,
        };

        if (typeof callback === 'function') {
          callback({
            success: true,
            room: publicRoom,
            playerId,
            playerToken,
          });
        }
        console.log(`👤 ${username} joined room: ${data.roomId} (${playerId})`);
      } catch (error) {
        console.error('Error joining room:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    socket.on('get-room', async (roomId: string, callback) => {
      try {
        if (!roomId || typeof roomId !== 'string') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid room ID' });
          }
          return;
        }

        const room = await RoomService.getRoom(roomId);
        if (!room) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found' });
          }
          return;
        }

        const publicRoom = {
          roomId: room.roomId,
          creatorId: room.creatorId,
          players: RoomService.sanitizePlayers(room.players),
          finishedPlayers: RoomService.sanitizeRankedPlayers(room.finishedPlayers || []),
          gameStarted: room.gameStarted,
          gameOver: room.gameOver,
          currentTurn: room.currentTurn,
          currentSuit: room.currentSuit,
          turnDirection: room.turnDirection,
          rules: room.rules,
          ruleConfig: room.ruleConfig,
          createdAt: room.createdAt,
        };

        if (typeof callback === 'function') {
          callback({ success: true, room: publicRoom });
        }
      } catch (error) {
        console.error('Error getting room:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to get room' });
        }
      }
    });
  }
}
