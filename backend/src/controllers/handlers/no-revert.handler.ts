import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { Card } from '../../types/game.types';

export class NoRevertHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('no-revert', async (data: { roomId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        // Check if there's an active blunder state for this player
        if (!room.blunderState || !room.blunderState.active || room.blunderState.playerId !== socket.id) {
          callback({ success: false, error: 'No active blunder to process' });
          return;
        }

        const blunderPlayer = room.players.find(p => p.id === socket.id);
        
        if (!blunderPlayer) {
          callback({ success: false, error: 'Player not found' });
          return;
        }

        // Store blunder info before clearing
        const cardsToReturn = room.blunderState.cards;
        const penalty = room.blunderState.penalty;

        // Return cards to player's hand
        blunderPlayer.cards.push(...cardsToReturn);

        // Draw penalty cards for the blunder
        const penaltyCards = this.drawCards(room, penalty);
        blunderPlayer.cards.push(...penaltyCards);

        // Advance turn to next player
        const currentIndex = room.players.findIndex(p => p.id === socket.id);
        const direction = room.turnDirection === 'clockwise' ? 1 : -1;
        const nextIndex = (currentIndex + direction + room.players.length) % room.players.length;
        room.currentTurn = room.players[nextIndex].id;

        // Clear blunder state
        room.blunderState = {
          active: false,
          playerId: '',
          cards: [],
          penalty: 0,
          timestamp: 0,
        };

        await RoomService.saveRoom(room);

        // Emit blunder-timeout event
        io.to(room.roomId).emit('game-event', {
          type: 'blunder-timeout',
          payload: {
            playerId: socket.id,
            penalty: penalty,
            message: 'Blunder not reverted - penalty applied',
          },
        });

        // Emit cards drawn event
        io.to(room.roomId).emit('game-event', {
          type: 'cards_drawn',
          playerId: socket.id,
          amount: penalty,
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
        console.log(`⏰ ${socket.id} blunder timeout - penalty ${penalty} cards applied, turn advanced`);
      } catch (error) {
        console.error('Error processing no-revert:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }

  /**
   * Draw cards from deck
   */
  private static drawCards(room: any, amount: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < amount; i++) {
      if (room.deck.length === 0) {
        if (room.pile && room.pile.length > 1) {
          const topCard = room.pile.pop()!;
          room.deck = this.shuffleDeck(room.pile);
          room.pile = [topCard];
        } else {
          break;
        }
      }

      const card = room.deck.pop();
      if (card) {
        drawn.push(card);
      }
    }

    return drawn;
  }

  /**
   * Shuffle deck
   */
  private static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
