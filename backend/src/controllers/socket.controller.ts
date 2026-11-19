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
import { RATE_LIMITS, RateLimitService } from '../services/rate-limit.service';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

const IP_SCOPED_EVENTS = new Set([
  'create-room',
  'join-room',
  'get-room',
  'rejoin-room',
  'no-revert',
]);

export class SocketController {
  static setupSocketHandlers(io: Server): void {
    // Handshake middleware: enforce connection rate limit and per-IP concurrent connection cap
    io.use(async (socket, next) => {
      const ip = RateLimitService.getClientIp(socket);

      const rateCheck = await RateLimitService.consume('connect', ip);
      if (!rateCheck.allowed) {
        metrics.inc('socket_connections_rejected_total');
        next(new Error('Too many connection attempts. Please try again later.'));
        return;
      }

      const connCheck = RateLimitService.registerConnection(ip);
      if (!connCheck.allowed) {
        next(new Error('Too many concurrent connections from this address.'));
        return;
      }

      socket.data.clientIp = ip;
      next();
    });

    io.on('connection', (socket: Socket) => {
      const ip = (socket.data.clientIp as string) || RateLimitService.getClientIp(socket);
      metrics.inc('socket_connections_total');
      metrics.incActiveConnections();

      logger.info('Client connected', { socketId: socket.id, ip });

      // Centralized per-event rate limiting and metrics middleware
      socket.use(async (packet, next) => {
        const eventName = typeof packet[0] === 'string' ? packet[0] : 'unknown';
        metrics.inc('socket_events_total');

        if (eventName in RATE_LIMITS) {
          const scope = IP_SCOPED_EVENTS.has(eventName) ? 'ip' : 'socket';
          const result = await RateLimitService.checkSocketEvent(socket, eventName, scope);
          if (!result.allowed) {
            const maybeCallback = packet[packet.length - 1];
            if (typeof maybeCallback === 'function') {
              maybeCallback({
                success: false,
                error: 'Too many requests. Please slow down and try again shortly.',
              });
            }
            return;
          }
        }

        next();
      });

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

      // Handle disconnect: release IP slot, preserve room state for reconnection, mark player offline under lock
      socket.on('disconnect', async (reason) => {
        RateLimitService.releaseConnection(ip);
        metrics.decActiveConnections();

        logger.info('Client disconnected', { socketId: socket.id, ip, reason });

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
