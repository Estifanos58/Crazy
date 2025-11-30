import type { RuleConfig, CardSelector, Rank, Suit } from '../types/game.types';

/**
 * RuleBuilder - Helper utility to construct custom rule configurations
 * 
 * Usage:
 * const customRules = new RuleBuilder()
 *   .setPunishmentCard('A', 'hearts', 7) // A♥ gives 7 cards
 *   .setRank2Penalty(3) // 2s give 3 cards each
 *   .setReverseCard('Q') // Queens reverse direction
 *   .setSkipCard('K') // Kings skip next player
 *   .build();
 */
export class RuleBuilder {
  private config: Partial<RuleConfig>;

  constructor(baseConfig?: Partial<RuleConfig>) {
    this.config = baseConfig || {};
  }

  /**
   * Set the special punishment card (default: A♠ = 5 cards)
   */
  setPunishmentCard(rank: Rank, suit: Suit, penalty: number): this {
    if (!this.config.punishment) {
      this.config.punishment = {
        aceSpadeCard: { rank: 'A', suit: 'spades' },
        aceSpadePenalty: 5,
        rank2Cards: ['2'],
        rank2Penalty: 2,
      };
    }
    this.config.punishment.aceSpadeCard = { rank, suit };
    this.config.punishment.aceSpadePenalty = penalty;
    return this;
  }

  /**
   * Set which ranks act as rank-2 punishment cards
   */
  setRank2Cards(ranks: Rank[], penalty: number): this {
    if (!this.config.punishment) {
      this.config.punishment = {
        aceSpadeCard: { rank: 'A', suit: 'spades' },
        aceSpadePenalty: 5,
        rank2Cards: ['2'],
        rank2Penalty: 2,
      };
    }
    this.config.punishment.rank2Cards = ranks;
    this.config.punishment.rank2Penalty = penalty;
    return this;
  }

  /**
   * Set rank-2 penalty amount
   */
  setRank2Penalty(penalty: number): this {
    if (!this.config.punishment) {
      this.config.punishment = {
        aceSpadeCard: { rank: 'A', suit: 'spades' },
        aceSpadePenalty: 5,
        rank2Cards: ['2'],
        rank2Penalty: 2,
      };
    }
    this.config.punishment.rank2Penalty = penalty;
    return this;
  }

  /**
   * Set cards that reverse turn direction
   * @param rank - Card rank (e.g., '5')
   * @param suit - Optional suit (if omitted, all suits of this rank)
   */
  setReverseCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.reverseCards = [selector];
    return this;
  }

  /**
   * Add multiple reverse cards
   */
  addReverseCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    this.config.specialCards.reverseCards = [
      ...(this.config.specialCards.reverseCards || []),
      ...cards,
    ];
    return this;
  }

  /**
   * Set cards that skip next player
   */
  setSkipCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.skipCards = [selector];
    return this;
  }

  /**
   * Add multiple skip cards
   */
  addSkipCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    this.config.specialCards.skipCards = [
      ...(this.config.specialCards.skipCards || []),
      ...cards,
    ];
    return this;
  }

  /**
   * Set cards that allow suit change
   */
  setSuitChangeCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    this.config.specialCards.suitChangeCards = cards;
    return this;
  }

  /**
   * Add a suit change card
   */
  addSuitChangeCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.suitChangeCards = [
      ...(this.config.specialCards.suitChangeCards || []),
      selector,
    ];
    return this;
  }

  /**
   * Configure crazy challenge system
   */
  setCrazyChallenge(enabled: boolean, penalty: number, responseTimeMs: number = 3000): this {
    this.config.crazyChallenge = {
      enabled,
      penalty,
      responseTimeMs,
    };
    return this;
  }

  /**
   * Set penalty for playing out of turn
   */
  setIllegalTurnPenalty(penalty: number): this {
    this.config.illegalTurnPenalty = penalty;
    return this;
  }

  /**
   * Allow/disallow dropping multiple cards of same suit
   */
  setAllowDropAllSameSuit(allow: boolean): this {
    this.config.allowDropAllSameSuit = allow;
    return this;
  }

  /**
   * Set win condition
   */
  setWinOnEmpty(winOnEmpty: boolean): this {
    this.config.winOnEmpty = winOnEmpty;
    return this;
  }

  /**
   * Build the final configuration
   */
  build(): Partial<RuleConfig> {
    return this.config;
  }

  /**
   * Reset to default configuration
   */
  reset(): this {
    this.config = {};
    return this;
  }

  /**
   * Get current configuration (read-only)
   */
  getConfig(): Readonly<Partial<RuleConfig>> {
    return this.config;
  }
}

/**
 * Pre-configured rule presets
 */
export class RulePresets {
  /**
   * Standard Crazy rules (default)
   */
  static standard(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 5)
      .setRank2Cards(['2'], 2)
      .setReverseCard('5')
      .setSkipCard('7')
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }])
      .setCrazyChallenge(true, 2, 3000)
      .setIllegalTurnPenalty(2)
      .setAllowDropAllSameSuit(true)
      .setWinOnEmpty(true)
      .build();
  }

  /**
   * Hardcore mode - higher penalties
   */
  static hardcore(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 7)
      .setRank2Cards(['2'], 3)
      .setReverseCard('5')
      .setSkipCard('7')
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }])
      .setCrazyChallenge(true, 3, 2000)
      .setIllegalTurnPenalty(3)
      .setAllowDropAllSameSuit(true)
      .setWinOnEmpty(true)
      .build();
  }

  /**
   * Beginner friendly - lower penalties
   */
  static beginner(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 3)
      .setRank2Cards(['2'], 1)
      .setReverseCard('5')
      .setSkipCard('7')
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }])
      .setCrazyChallenge(true, 1, 5000)
      .setIllegalTurnPenalty(1)
      .setAllowDropAllSameSuit(true)
      .setWinOnEmpty(true)
      .build();
  }

  /**
   * Chaos mode - all face cards have special effects
   */
  static chaos(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 5)
      .setRank2Cards(['2'], 2)
      .addReverseCards([{ rank: '5' }, { rank: 'Q' }]) // 5s and Queens reverse
      .addSkipCards([{ rank: '7' }, { rank: 'K' }]) // 7s and Kings skip
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }, { rank: 'A' }]) // J, 8, and Aces change suit
      .setCrazyChallenge(true, 2, 3000)
      .setIllegalTurnPenalty(2)
      .setAllowDropAllSameSuit(true)
      .setWinOnEmpty(true)
      .build();
  }

  /**
   * No special cards - pure strategy
   */
  static classic(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 0) // No punishment
      .setRank2Cards([], 0) // No rank-2 punishment
      .setSuitChangeCards([]) // No suit change
      .setCrazyChallenge(false, 0, 0)
      .setIllegalTurnPenalty(1)
      .setAllowDropAllSameSuit(false)
      .setWinOnEmpty(true)
      .build();
  }
}

/**
 * Validation helpers
 */
export class RuleValidator {
  /**
   * Validate a rule configuration
   */
  static validate(config: Partial<RuleConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.punishment) {
      if (config.punishment.aceSpadePenalty < 0) {
        errors.push('A♠ penalty cannot be negative');
      }
      if (config.punishment.rank2Penalty < 0) {
        errors.push('Rank-2 penalty cannot be negative');
      }
    }

    if (config.crazyChallenge) {
      if (config.crazyChallenge.penalty < 0) {
        errors.push('Crazy challenge penalty cannot be negative');
      }
      if (config.crazyChallenge.responseTimeMs < 0) {
        errors.push('Response time cannot be negative');
      }
    }

    if (config.illegalTurnPenalty !== undefined && config.illegalTurnPenalty < 0) {
      errors.push('Illegal turn penalty cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize configuration (ensure valid values)
   */
  static sanitize(config: Partial<RuleConfig>): Partial<RuleConfig> {
    const sanitized = { ...config };

    if (sanitized.punishment) {
      sanitized.punishment = {
        ...sanitized.punishment,
        aceSpadePenalty: Math.max(0, sanitized.punishment.aceSpadePenalty),
        rank2Penalty: Math.max(0, sanitized.punishment.rank2Penalty),
      };
    }

    if (sanitized.crazyChallenge) {
      sanitized.crazyChallenge = {
        ...sanitized.crazyChallenge,
        penalty: Math.max(0, sanitized.crazyChallenge.penalty),
        responseTimeMs: Math.max(0, sanitized.crazyChallenge.responseTimeMs),
      };
    }

    if (sanitized.illegalTurnPenalty !== undefined) {
      sanitized.illegalTurnPenalty = Math.max(0, sanitized.illegalTurnPenalty);
    }

    return sanitized;
  }
}
