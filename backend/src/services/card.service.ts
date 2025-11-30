import type { Card, Suit, Rank } from '../types/game.types';

export class CardService {
  private static suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  private static ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  static createDeck(): Card[] {
    const deck: Card[] = [];
    
    for (const suit of this.suits) {
      for (const rank of this.ranks) {
        deck.push({
          suit,
          rank,
          id: `${rank}-${suit}`,
        });
      }
    }
    
    return deck;
  }

  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  static dealCards(deck: Card[], numPlayers: number, cardsPerPlayer: number): {
    playerHands: Card[][];
    remainingDeck: Card[];
  } {
    const playerHands: Card[][] = Array(numPlayers).fill(null).map(() => []);
    let currentDeck = [...deck];

    // Deal cards to each player
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let j = 0; j < numPlayers; j++) {
        if (currentDeck.length > 0) {
          playerHands[j].push(currentDeck.pop()!);
        }
      }
    }

    // Give one extra card to the first player (starting player)
    if (currentDeck.length > 0) {
      playerHands[0].push(currentDeck.pop()!);
    }

    return {
      playerHands,
      remainingDeck: currentDeck,
    };
  }
}
