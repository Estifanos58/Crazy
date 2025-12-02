import type { GameState, RuleConfig, Card, GameEvent, Suit } from '../../types/game.types';

/**
 * SpecialEffectsHandler - Handles special card effects
 */
export class SpecialEffectsHandler {
  /**
   * Apply special card effects (reverse, skip, suit change)
   * Returns flags indicating which special effects were triggered
   */
  static applyEffects(
    state: GameState,
    card: Card,
    config: RuleConfig,
    chosenSuit?: Suit
  ): { events: GameEvent[]; stateChanges: Partial<GameState>; isReverse: boolean; isSkip: boolean } {
    const events: GameEvent[] = [];
    const stateChanges: Partial<GameState> = {};
    let isReverse = false;
    let isSkip = false;

    // Check and apply reverse
    const reverseEffect = this.checkReverse(card, state, config);
    if (reverseEffect) {
      events.push(reverseEffect.event);
      Object.assign(stateChanges, reverseEffect.stateChanges);
      isReverse = true;
    }

    // Check and apply skip
    const skipEffect = this.checkSkip(card, state, config);
    if (skipEffect) {
      events.push(skipEffect.event);
      Object.assign(stateChanges, skipEffect.stateChanges);
      isSkip = true;
    }

    // Check and apply suit change
    const suitChangeEffect = this.checkSuitChange(card, config, chosenSuit);
    if (suitChangeEffect) {
      events.push(suitChangeEffect.event);
      Object.assign(stateChanges, suitChangeEffect.stateChanges);
    }

    return { events, stateChanges, isReverse, isSkip };
  }

  /**
   * Check and handle reverse effect
   */
  private static checkReverse(
    card: Card,
    state: GameState,
    config: RuleConfig
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isReverse = config.specialCards.reverseCards.some(rc =>
      rc.rank === card.rank && (!rc.suit || rc.suit === card.suit)
    );

    if (!isReverse) return null;

    const newDirection = state.turnDirection === 'clockwise' ? 'counterclockwise' : 'clockwise';

    return {
      event: {
        type: 'turn-reversed',
        payload: { direction: newDirection },
      },
      stateChanges: {
        turnDirection: newDirection,
      },
    };
  }

  /**
   * Check and handle skip effect
   */
  private static checkSkip(
    card: Card,
    state: GameState,
    config: RuleConfig
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isSkip = config.specialCards.skipCards.some(sc =>
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
    );

    if (!isSkip) return null;

    const nextPlayerId = this.getNextPlayer(state);

    return {
      event: {
        type: 'player-skipped',
        payload: { playerId: nextPlayerId },
      },
      stateChanges: {
        // Skip will be handled by advancing turn twice
      },
    };
  }

  /**
   * Check and handle suit change effect
   */
  private static checkSuitChange(
    card: Card,
    config: RuleConfig,
    chosenSuit?: Suit
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isSuitChange = config.specialCards.suitChangeCards.some(sc =>
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
    );

    if (!isSuitChange || !chosenSuit) return null;

    return {
      event: {
        type: 'suit-changed',
        payload: { suit: chosenSuit },
      },
      stateChanges: {
        currentSuit: chosenSuit,
      },
    };
  }

  /**
   * Get next player in turn order
   */
  private static getNextPlayer(state: GameState): string {
    const currentIndex = state.players.findIndex(p => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    const direction = state.turnDirection === 'clockwise' ? 1 : -1;
    const nextIndex = (currentIndex + direction + state.players.length) % state.players.length;
    
    return state.players[nextIndex].id;
  }
}
