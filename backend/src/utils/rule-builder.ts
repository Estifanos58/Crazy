import type { CardSelector, Rank, RuleConfig, RulePresetName, Suit } from '../types/game.types';
import { partialRuleConfigSchema } from '../validation/socket.schemas';

/**
 * RuleBuilder - Helper utility to construct custom rule configurations
 */
export class RuleBuilder {
  private config: Partial<RuleConfig>;

  constructor(baseConfig?: Partial<RuleConfig>) {
    this.config = baseConfig || {};
  }

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

  setReverseCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.reverseCards = [selector];
    return this;
  }

  addReverseCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    this.config.specialCards.reverseCards = [
      ...(this.config.specialCards.reverseCards || []),
      ...cards,
    ];
    return this;
  }

  setSkipCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.skipCards = [selector];
    return this;
  }

  addSkipCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    this.config.specialCards.skipCards = [
      ...(this.config.specialCards.skipCards || []),
      ...cards,
    ];
    return this;
  }

  setSuitChangeCards(cards: CardSelector[]): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    this.config.specialCards.suitChangeCards = cards;
    return this;
  }

  addSuitChangeCard(rank: Rank, suit?: Suit): this {
    if (!this.config.specialCards) {
      this.config.specialCards = {
        reverseCards: [],
        skipCards: [],
        suitChangeCards: [],
        dropCards: { rank: '7' },
      };
    }
    const selector: CardSelector = { rank, suit };
    this.config.specialCards.suitChangeCards = [
      ...(this.config.specialCards.suitChangeCards || []),
      selector,
    ];
    return this;
  }

  setCrazyChallenge(enabled: boolean, penalty: number, responseTimeMs = 3000): this {
    this.config.crazyChallenge = {
      enabled,
      penalty,
      responseTimeMs,
    };
    return this;
  }

  setIllegalTurnPenalty(penalty: number): this {
    this.config.illegalTurnPenalty = penalty;
    return this;
  }

  setAllowDropAllSameSuit(allow: boolean): this {
    this.config.allowDropAllSameSuit = allow;
    return this;
  }

  setWinOnEmpty(winOnEmpty: boolean): this {
    this.config.winOnEmpty = winOnEmpty;
    return this;
  }

  build(): Partial<RuleConfig> {
    return this.config;
  }

  reset(): this {
    this.config = {};
    return this;
  }

  getConfig(): Readonly<Partial<RuleConfig>> {
    return this.config;
  }
}

/**
 * Pre-configured rule presets
 */
export class RulePresets {
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

  static chaos(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 5)
      .setRank2Cards(['2'], 2)
      .addReverseCards([{ rank: '5' }, { rank: 'Q' }])
      .addSkipCards([{ rank: '7' }, { rank: 'K' }])
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }, { rank: 'A' }])
      .setCrazyChallenge(true, 2, 3000)
      .setIllegalTurnPenalty(2)
      .setAllowDropAllSameSuit(true)
      .setWinOnEmpty(true)
      .build();
  }

  static classic(): Partial<RuleConfig> {
    return new RuleBuilder()
      .setPunishmentCard('A', 'spades', 0)
      .setRank2Cards([], 0)
      .setSuitChangeCards([])
      .setCrazyChallenge(false, 0, 1000)
      .setIllegalTurnPenalty(1)
      .setAllowDropAllSameSuit(false)
      .setWinOnEmpty(true)
      .build();
  }

  static getByName(preset: RulePresetName): Partial<RuleConfig> {
    switch (preset) {
      case 'hardcore':
        return this.hardcore();
      case 'beginner':
        return this.beginner();
      case 'chaos':
        return this.chaos();
      case 'classic':
        return this.classic();
      case 'standard':
      default:
        return this.standard();
    }
  }
}

/**
 * Runtime validation helpers for custom rule configurations
 */
export class RuleValidator {
  static validate(config: unknown): { valid: boolean; errors: string[] } {
    if (config === undefined) {
      return { valid: true, errors: [] };
    }

    const parsed = partialRuleConfigSchema.safeParse(config);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.issues.map((issue) =>
          issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message
        ),
      };
    }

    return { valid: true, errors: [] };
  }
}
