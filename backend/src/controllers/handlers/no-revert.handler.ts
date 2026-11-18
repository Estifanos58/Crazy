import type { Server, Socket } from 'socket.io';
import { formatZodError, roomActionSchema } from '../../validation/socket.schemas';
import { logger } from '../../utils/logger';

/**
 * Client-initiated blunder expiration is explicitly disallowed.
 * Only authoritative server-side timers in BlunderService may resolve expired blunders.
 */
export class NoRevertHandler {
  static handle(socket: Socket, _io: Server): void {
    socket.on('no-revert', (rawPayload: unknown, callback) => {
      const parsed = roomActionSchema.safeParse(rawPayload);
      const roomId = parsed.success ? parsed.data.roomId : undefined;

      logger.warn('Rejected unauthorized client no-revert attempt', {
        socketId: socket.id,
        roomId,
      });

      if (typeof callback === 'function') {
        callback({
          success: false,
          error: parsed.success
            ? 'Blunder timeouts are resolved automatically by the server'
            : formatZodError(parsed.error),
        });
      }
    });
  }
}
