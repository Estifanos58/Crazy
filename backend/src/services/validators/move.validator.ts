import type { Card, GameState, RuleConfig } from '../../types/game.types';
import { matchesAnyCardSelector, matchesCardSelector } from '../../utils/card-selector';

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
    const player = gameState.players.find((p) => p.id === playerId);
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
        (c) => c.id === card.id && c.rank === card.rank && c.suit === card.suit
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
   * Check if cards can respond to an active punishment chain
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

    const aceSelector = config.punishment.aceSpadeCard;
    const isCardAcePunisher =
      config.punishment.aceSpadePenalty > 0 && matchesCardSelector(card, aceSelector);
    const isLastAcePunisher = matchesCardSelector(lastPunishmentCard, aceSelector);
    const aceSuit = aceSelector.suit;

    // A♠ (or configured special punisher) can respond to a rank-2 of the matching suit
    if (
      isCardAcePunisher &&
      config.punishment.rank2Cards.includes(lastPunishmentCard.rank) &&
      (!aceSuit || lastPunishmentCard.suit === aceSuit)
    ) {
      return true;
    }

    // Check if it's a rank-2 punishment card
    if (config.punishment.rank2Penalty > 0 && config.punishment.rank2Cards.includes(card.rank)) {
      if (isLastAcePunisher) {
        return !aceSuit || card.suit === aceSuit;
      }
      return card.suit === lastPunishmentCard.suit;
    }

    return false;
  }

  /**
   * Validate multiple cards play
   * Per rules:
   * 1) All cards must have same suit
   * 2) The suit must match the current playing suit (if pile is non-empty)
   * 3) Must have a drop card (default: 7) matching dropCards selector
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

    // Must have a drop card matching selector (both rank and optional suit)
    const hasDropCard = cards.some((c) => matchesCardSelector(c, config.specialCards.dropCards));

    if (!hasDropCard) {
      return {
        valid: false,
        errors: [`Multiple cards require a drop card (${config.specialCards.dropCards.rank})`],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // All must be same suit
    const firstSuit = cards[0].suit;
    const allSameSuit = cards.every((c) => c.suit === firstSuit);

    if (!allSameSuit) {
      return {
        valid: false,
        errors: ['All cards must be same suit - blunder!'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // The suit of the thrown cards must match the current playing suit
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

    // Suit change cards can always be played (matching both rank and optional suit)
    const isSuitChangeCard = matchesAnyCardSelector(card, config.specialCards.suitChangeCards);

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
