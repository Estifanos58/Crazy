import type { Server, Socket } from 'socket.io';
import { RoomService } from '../services/room.service';
import { CreateRoomHandler } from './handlers/create-room.handler';
import { JoinRoomHandler } from './handlers/join-room.handler';
import { StartGameHandler } from './handlers/start-game.handler';
import { PlayCardHandler } from './handlers/play-card.handler';
import { PunishmentHandler } from './handlers/punishment.handler';
import { CrazyCallHandler } from './handlers/crazy-call.handler';
import { ReconnectionHandler } from './handlers/reconnection.handler';
import { BlunderHandler } from './handlers/blunder.handler';
import { LeaveGameHandler } from './handlers/leave-game.handler';

export class SocketController {
  static setupSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Room management
      CreateRoomHandler.handle(socket, io);
      JoinRoomHandler.handle(socket, io);
      StartGameHandler.handle(socket, io);

      // Game actions
      PlayCardHandler.handle(socket, io);
      PunishmentHandler.handle(socket, io);
      CrazyCallHandler.handle(socket, io);
      BlunderHandler.handle(socket, io);
      LeaveGameHandler.handle(socket, io);

      // Connection management
      ReconnectionHandler.handle(socket, io);

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });
  }
}
