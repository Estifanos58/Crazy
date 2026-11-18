import type { Server, Socket } from 'socket.io';
import { CreateRoomHandler } from './handlers/create-room.handler';
import { JoinRoomHandler } from './handlers/join-room.handler';
import { StartGameHandler } from './handlers/start-game.handler';
import { PlayCardHandler } from './handlers/play-card.handler';
import { PunishmentHandler } from './handlers/punishment.handler';
import { CrazyCallHandler } from './handlers/crazy-call.handler';
import { ReconnectionHandler } from './handlers/reconnection.handler';
import { BlunderHandler } from './handlers/blunder.handler';
import { NoRevertHandler } from './handlers/no-revert.handler';
import { LeaveGameHandler } from './handlers/leave-game.handler';
import { PlayAgainHandler } from './handlers/play-again.handler';
import { RoomService } from '../services/room.service';
import { GameBroadcaster } from '../services/game-broadcaster.service';
import { logger } from '../utils/logger';

export class SocketController {
  static setupSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id });

      // Room management
      CreateRoomHandler.handle(socket, io);
      JoinRoomHandler.handle(socket, io);
      StartGameHandler.handle(socket, io);
      PlayAgainHandler.handle(socket, io);

      // Game actions
      PlayCardHandler.handle(socket, io);
      PunishmentHandler.handle(socket, io);
      CrazyCallHandler.handle(socket, io);
      BlunderHandler.handle(socket, io);
      NoRevertHandler.handle(socket, io);
      LeaveGameHandler.handle(socket, io);

      // Connection management
      ReconnectionHandler.handle(socket, io);

      // Handle disconnect: preserve room state for reconnection, mark player offline under lock
      socket.on('disconnect', async (reason) => {
        logger.info('Client disconnected', { socketId: socket.id, reason });

        const roomId = socket.data?.roomId as string | undefined;
        const playerId = socket.data?.playerId as string | undefined;
        if (!roomId) return;

        try {
          const updatedRoom = await RoomService.markPlayerDisconnected(roomId, socket.id, playerId);
          if (updatedRoom && playerId) {
            io.to(roomId).emit('player-disconnected', {
              playerId,
              players: GameBroadcaster.sanitizePlayers(updatedRoom.players),
            });
          }
        } catch (error) {
          logger.warn('Failed to mark player disconnected', {
            roomId,
            playerId,
            error: error instanceof Error ? error : String(error),
          });
        }
      });
    });
  }
}
