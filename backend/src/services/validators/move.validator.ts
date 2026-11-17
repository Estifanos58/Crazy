import type { GameState, RuleConfig, Card } from '../../types/game.types';

/**
 * MoveValidator - Authoritative move validation logic
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

    // Strictly enforce turn ownership - playing out of turn is NEVER a challengeable blunder
    if (gameState.currentTurn !== playerId) {
      return {
        valid: false,
        errors: ['Not your turn'],
        canChallengeCrazy: false,
      };
    }

    // Check if player exists
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, errors: ['Player not found'], canChallengeCrazy: false };
    }

    // Validate cards payload
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return { valid: false, errors: ['No cards played'], canChallengeCrazy: false };
    }

    // Reject duplicate card IDs within the played cards
    const cardIds = new Set<string>();
    for (const card of cards) {
      if (!card || !card.id || !card.rank || !card.suit) {
        return { valid: false, errors: ['Invalid card format'], canChallengeCrazy: false };
      }
      if (cardIds.has(card.id)) {
        return { valid: false, errors: ['Duplicate card played'], canChallengeCrazy: false };
      }
      cardIds.add(card.id);
    }

    // Validate cards are strictly in player's authoritative server hand
    for (const card of cards) {
      const cardInHand = player.cards.find(
        c => c.id === card.id && c.rank === card.rank && c.suit === card.suit
      );
      if (!cardInHand) {
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
          errors: ['Must play A♠ or 2 of the same suit to respond to punishment - blunder!'],
          canChallengeCrazy: config.crazyChallenge.enabled,
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

    if (!lastPunishmentCard) return false;

    // Check if it's A♠ (can respond to 2♠)
    if (
      card.rank === config.punishment.aceSpadeCard.rank && 
      card.suit === config.punishment.aceSpadeCard.suit && 
      config.punishment.rank2Cards.includes(lastPunishmentCard.rank) && 
      lastPunishmentCard.suit === 'spades'
    ) {
      return true;
    }

    // Check if it's a 2
    if (config.punishment.rank2Cards.includes(card.rank)) {
      if (punishmentCards.length > 0) {
        // If punishment started with A♠, 2 of spades can respond
        if (
          lastPunishmentCard.rank === config.punishment.aceSpadeCard.rank &&
          lastPunishmentCard.suit === config.punishment.aceSpadeCard.suit
        ) {
          return card.suit === 'spades';
        }
        // Otherwise, 2 must match the suit of the last punishment card
        return card.suit === lastPunishmentCard.suit;
      }
      return true;
    }

    return false;
  }

  /**
   * Validate multiple cards play
   * Per rules: 
   * 1) All cards must have same suit
   * 2) The suit must match the current playing suit
   * 3) Must have a drop card (7) present
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

    // All must be same suit
    const firstSuit = cards[0].suit;
    const allSameSuit = cards.every(c => c.suit === firstSuit);
    
    if (!allSameSuit) {
      return {
        valid: false,
        errors: ['All cards must be same suit - blunder!'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // The suits of the thrown cards must match the current playing suit
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
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
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
