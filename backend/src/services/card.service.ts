import crypto from 'node:crypto';
import { RANKS, SUITS } from '../types/game.types';
import type { Card } from '../types/game.types';

export class CardService {
  static createDeck(): Card[] {
    const deck: Card[] = [];

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit,
          rank,
          id: `${rank}-${suit}`,
        });
      }
    }

    return deck;
  }

  /**
   * Cryptographically secure Fisher-Yates shuffle using Node's CSPRNG (crypto.randomInt).
   */
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  static dealCards(
    deck: Card[],
    numPlayers: number,
    cardsPerPlayer: number
  ): {
    playerHands: Card[][];
    remainingDeck: Card[];
  } {
    const playerHands: Card[][] = Array.from({ length: numPlayers }, () => []);
    const currentDeck = [...deck];

    // Deal cards to each player
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let j = 0; j < numPlayers; j++) {
        if (currentDeck.length > 0) {
          playerHands[j].push(currentDeck.pop()!);
        }
      }
    }

    // Give one extra card to the first player (starting player)
    if (numPlayers > 0 && currentDeck.length > 0) {
      playerHands[0].push(currentDeck.pop()!);
    }

    return {
      playerHands,
      remainingDeck: currentDeck,
    };
  }

  /**
   * Authoritative method to draw cards from deck with automatic pile reshuffling.
   */
  static drawCards(room: { deck: Card[]; pile?: Card[] }, amount: number): Card[] {
    const requested = Math.floor(amount);
    if (requested <= 0) {
      return [];
    }

    const drawn: Card[] = [];

    for (let i = 0; i < requested; i++) {
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
}
