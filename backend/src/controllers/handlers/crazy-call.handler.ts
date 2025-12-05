import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import type { Card } from '../../types/game.types';

export class CrazyCallHandler {
  static handle(socket: Socket, io: Server): void {
    socket.on('call-crazy', async (data: { roomId: string; targetPlayerId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        // Check if there's an active blunder state
        if (!room.blunderState || !room.blunderState.active) {
          callback({ success: false, error: 'No active blunder to challenge' });
          return;
        }

        // Verify the target is the player who made the blunder
        if (room.blunderState.playerId !== data.targetPlayerId) {
          callback({ success: false, error: 'Target player does not have an active blunder' });
          return;
        }

        const blunderPlayer = room.players.find(p => p.id === room.blunderState!.playerId);
        
        if (!blunderPlayer) {
          callback({ success: false, error: 'Blunder player not found' });
          return;
        }

        // Remove the blundered cards from pile
        const cardsToReturn = room.blunderState.cards;
        for (let i = 0; i < cardsToReturn.length; i++) {
          room.pile?.pop();
        }

        // Return cards to player's hand
        blunderPlayer.cards.push(...cardsToReturn);

        // Restore previous suit from new top card
        if (room.pile && room.pile.length > 0) {
          const previousTopCard = room.pile[room.pile.length - 1];
          room.currentSuit = previousTopCard.suit;
        }

        // Apply penalty to the blunder player
        const penaltyCards = this.drawCards(room, room.blunderState.penalty);
        blunderPlayer.cards.push(...penaltyCards);

        // Keep turn with the blunder player (they continue playing)
        room.currentTurn = room.blunderState.playerId;

        // Clear blunder state
        const blunderPlayerId = room.blunderState.playerId;
        const penalty = room.blunderState.penalty;
        room.blunderState = {
          active: false,
          playerId: '',
          cards: [],
          penalty: 0,
          timestamp: 0,
        };

        await RoomService.saveRoom(room);

        // Emit crazy-called success event
        io.to(room.roomId).emit('game-event', {
          type: 'crazy-called',
          payload: {
            success: true,
            callerId: socket.id,
            targetId: blunderPlayerId,
            penalty: penalty,
          },
        });

        // Emit cards drawn event
        io.to(room.roomId).emit('game-event', {
          type: 'cards_drawn',
          playerId: blunderPlayerId,
          amount: penalty,
        });

        // Broadcast updated game state to all players
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
        console.log(`🚨 ${socket.id} called crazy on ${blunderPlayerId} - penalty: ${penalty} cards`);
      } catch (error) {
        console.error('Error calling crazy:', error);
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
