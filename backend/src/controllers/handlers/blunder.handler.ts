import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { Card } from '../../types/game.types';

export class BlunderHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('revert-blunder', async (data: { roomId: string; cards: Card[] }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        const player = room.players.find(p => p.id === socket.id);
        
        if (!player) {
          callback({ success: false, error: 'Player not found' });
          return;
        }

        // Check if there are cards to revert
        if (!room.pile || room.pile.length < data.cards.length) {
          callback({ success: false, error: 'No cards to revert' });
          return;
        }

        // Pop the blundered cards from pile
        const cardsToRevert = data.cards;
        for (let i = 0; i < cardsToRevert.length; i++) {
          room.pile.pop();
        }

        // Return cards to player's hand
        player.cards.push(...cardsToRevert);

        // Restore previous suit from new top card
        if (room.pile.length > 0) {
          const previousTopCard = room.pile[room.pile.length - 1];
          room.currentSuit = previousTopCard.suit;
        }

        // Player keeps their turn (no turn advance)
        await RoomService.saveRoom(room);

        // Emit blunder-reverted event
        io.to(room.roomId).emit('game-event', {
          type: 'blunder-reverted',
          payload: {
            playerId: socket.id,
            message: 'Move reverted successfully',
          },
        });

        // Broadcast updated game state
        room.players.forEach(p => {
          io.to(p.id).emit('game-update', {
            players: room.players.map(pl => ({
              id: pl.id,
              username: pl.username,
              avatar: pl.avatar,
              cardCount: pl.cards.length,
            })),
            currentTurn: room.currentTurn,
            topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined,
            currentSuit: room.currentSuit,
            yourCards: p.cards,
            punishmentChain: room.punishmentChain,
          });
        });

        callback({ success: true });
        console.log(`↩️ ${socket.id} reverted blunder in room ${data.roomId}`);
      } catch (error) {
        console.error('Error reverting blunder:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
