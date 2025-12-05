import type { GameState, RuleConfig, Card } from '../../types/game.types';

/**
 * MoveValidator - Handles move validation logic
 */
export class MoveValidator {
  /**
   * Validate if a player can play cards
   */
  static validateMove(
    gameState: GameState,
    playerId: string,
    cards: Card[],
    config: RuleConfig
  ): { valid: boolean; errors: string[]; canChallengeCrazy: boolean } {
    const errors: string[] = [];

    // Check if it's player's turn
    if (gameState.currentTurn !== playerId) {
      return {
        valid: false,
        errors: ['Not your turn'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // Check if player exists
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, errors: ['Player not found'], canChallengeCrazy: false };
    }

    // Validate cards are in player's hand
    for (const card of cards) {
      if (!player.cards.some(c => c.id === card.id)) {
        errors.push(`Card ${card.rank} of ${card.suit} not in your hand`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, canChallengeCrazy: false };
    }

    // Check punishment chain
    if (gameState.punishmentChain.active) {
      const canRespond = this.canRespondToPunishment(cards, config, gameState);
      if (!canRespond) {
        return {
          valid: false,
          errors: ['Must play A♠ or 2 of the same suit to respond to punishment'],
          canChallengeCrazy: false,
        };
      }
      return { valid: true, errors: [], canChallengeCrazy: false };
    }

    // Validate multiple cards
    if (cards.length > 1) {
      return this.validateMultipleCards(cards, config, gameState);
    }

    // Validate single card
    return this.validateSingleCard(cards[0], gameState, config);
  }

  /**
   * Check if cards can respond to punishment
   */
  private static canRespondToPunishment(
    cards: Card[], 
    config: RuleConfig,
    gameState: GameState
  ): boolean {
    if (cards.length !== 1) return false;
    
    const card = cards[0];
    const punishmentCards = gameState.punishmentChain.cards;
    const lastPunishmentCard = punishmentCards[punishmentCards.length - 1];



    // // Check if it's A♠ (can respond to 2♠)
    if (card.rank === config.punishment.aceSpadeCard.rank && 
        card.suit === config.punishment.aceSpadeCard.suit && lastPunishmentCard.rank === config.punishment.rank2Cards[0] && lastPunishmentCard.suit === 'spades') {
      return true;
    }

    // Check if it's a 2 - must be same suit as the punishment initiator
    if (config.punishment.rank2Cards.includes(card.rank)) {
      // Get the last card in the punishment chain
      if (punishmentCards.length > 0) {
        // If punishment started with A♠, any 2 of spades can respond
        if (lastPunishmentCard.rank === config.punishment.aceSpadeCard.rank &&
            lastPunishmentCard.suit === config.punishment.aceSpadeCard.suit) {
          return card.suit === 'spades';
        }
        // Otherwise, 2 must match the suit of the last punishment card
        return card.suit === lastPunishmentCard.suit;
      }
      // If no cards in chain yet, any 2 can start it
      return true;
    }

    return false;
  }

  /**
   * Validate multiple cards play
   * Per rules: 
   * 1) All cards must have same suit (no different suits within thrown cards)
   * 2) The suit must match the current playing suit
   * 3) Must have a drop/skip card (7) present to drop multiple cards
   */
  private static validateMultipleCards(
    cards: Card[],
    config: RuleConfig,
    gameState: GameState
  ): { valid: boolean; errors: string[]; canChallengeCrazy: boolean } {
    if (!config.allowDropAllSameSuit) {
      return {
        valid: false,
        errors: ['Cannot play multiple cards'],
        canChallengeCrazy: false,
      };
    }

    // // Check if any card is a suit-changing card (J or 8)
    // const hasSuitChangeCard = cards.some(c => 
    //   config.specialCards.suitChangeCards.some(sc => 
    //     sc.rank === c.rank && (!sc.suit || sc.suit === c.suit)
    //   )
    // );

    // // Suit-changing cards (J, 8) CANNOT be played with other cards
    // if (hasSuitChangeCard) {
    //   return {
    //     valid: false,
    //     errors: ['Suit-changing cards (J, 8) must be played alone'],
    //     canChallengeCrazy: config.crazyChallenge.enabled,
    //   };
    // }

    // Must have a drop card (7) per rules
    const hasDropCard = cards.some(c => 
      c.rank === config.specialCards.dropCards.rank
    );

    if (!hasDropCard) {
      return {
        valid: false,
        errors: ['Multiple cards require a drop card (7)'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // All must be same suit (no different suits within thrown cards list)
    const firstSuit = cards[0].suit;
    const allSameSuit = cards.every(c => c.suit === firstSuit);
    
    if (!allSameSuit) {
      return {
        valid: false,
        errors: ['All cards must be same suit - blunder!'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // Per rules: The suits of the thrown cards must match the current playing suit
    if (gameState.pile.length > 0 && firstSuit !== gameState.currentSuit) {
      return {
        valid: false,
        errors: [`Cards must match current suit (${gameState.currentSuit}) - blunder!`],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    return { valid: true, errors: [], canChallengeCrazy: false };
  }

  /**
   * Validate single card play
   */
  private static validateSingleCard(
    card: Card,
    gameState: GameState,
    config: RuleConfig
  ): { valid: boolean; errors: string[]; canChallengeCrazy: boolean } {
    // First card of game
    if (gameState.pile.length === 0) {
      return { valid: true, errors: [], canChallengeCrazy: false };
    }

    const topCard = gameState.pile[gameState.pile.length - 1];
    const matchesSuit = card.suit === gameState.currentSuit;
    const matchesRank = card.rank === topCard.rank;

    // Suit change cards can always be played
    const isSuitChangeCard = config.specialCards.suitChangeCards.some(sc => 
      sc.rank === card.rank
    );

    if (!matchesSuit && !matchesRank && !isSuitChangeCard) {
      return {
        valid: false,
        errors: [`Card must match suit (${gameState.currentSuit}) or rank (${topCard.rank})`],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    return { valid: true, errors: [], canChallengeCrazy: false };
  }
}
