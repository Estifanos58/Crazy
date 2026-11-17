import type { Server, Socket } from 'socket.io';
import { GameOrchestrator } from '../../services/game.orchestrator';
import type { Card, Suit } from '../../types/game.types';

export class PlayCardHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on(
      'play-card',
      async (
        data: {
          roomId: string;
          cards: Card[];
          chosenSuit?: Suit;
          playerId?: string;
          playerToken?: string;
        },
        callback
      ) => {
        try {
          if (!data || !data.roomId || !Array.isArray(data.cards) || data.cards.length === 0) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid card play payload' });
            }
            return;
          }

          // Validate chosenSuit if provided
          const validSuits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
          if (data.chosenSuit && !validSuits.includes(data.chosenSuit)) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid chosen suit' });
            }
            return;
          }

          const result = await GameOrchestrator.playCard(
            data.roomId,
            socket.id,
            data.cards,
            data.chosenSuit,
            data.playerId,
            data.playerToken,
            io
          );

          if (!result.success && !result.isBlunder) {
            if (typeof callback === 'function') {
              callback({ success: false, error: result.error });
            }
            return;
          }

          // Emit game events
          result.events.forEach(event => {
            io.to(data.roomId).emit('game-event', event);
          });

          // Broadcast updated room state
          if (result.room) {
            GameOrchestrator.broadcastGameUpdate(result.room, io);
          }

          if (typeof callback === 'function') {
            callback({
              success: true,
              isBlunder: result.isBlunder,
            });
          }
        } catch (error) {
          console.error('Error playing card:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
