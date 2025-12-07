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
    chosenSuit?: Suit,
    multipleCards: boolean = false,
    playerId?: string
  ): { events: GameEvent[]; stateChanges: Partial<GameState>; isReverse: boolean; isSkip: boolean } {
    const events: GameEvent[] = [];
    const stateChanges: Partial<GameState> = {};
    let isReverse = false;
    let isSkip = false;

    // When multiple cards are played, reverse and skip effects should NOT trigger
    if (!multipleCards) {
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
    }

    // Check and apply suit change (with consecutive tracking)
    const suitChangeEffect = this.checkSuitChange(card, config, chosenSuit, state, playerId);
    if (suitChangeEffect) {
      events.push(suitChangeEffect.event);
      Object.assign(stateChanges, suitChangeEffect.stateChanges);
    }

    return { events, stateChanges, isReverse, isSkip };
  }

  /**
   * Check and handle reverse effect
   * Per rules: Reverse changes direction, and the previous player (in old direction) continues
   */
  private static checkReverse(
    card: Card,
    state: GameState,
    config: RuleConfig
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isReverse = config.specialCards.reverseCards.some(rc =>
      rc.rank === card.rank 
    );

    if (!isReverse) return null;

    const newDirection = state.turnDirection === 'clockwise' ? 'counterclockwise' : 'clockwise';
    // Get the previous player in the OLD direction (before reversing)
    const previousPlayer = this.getPreviousPlayerInDirection(state, state.turnDirection);

    return {
      event: {
        type: 'turn-reversed',
        payload: { direction: newDirection },
      },
      stateChanges: {
        turnDirection: newDirection,
        // Set turn to the previous player (who becomes the next player after reversal)
        currentTurn: previousPlayer,
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
      sc.rank === card.rank 
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
   * Rule: If player A changes suit, player B (next) cannot change suit,
   * but player C (third) can change suit again
   */
  private static checkSuitChange(
    card: Card,
    config: RuleConfig,
    chosenSuit?: Suit,
    state?: GameState,
    playerId?: string
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isSuitChange = config.specialCards.suitChangeCards.some(sc =>
      sc.rank === card.rank
    );

    if (!isSuitChange || !chosenSuit) return null;

    // Check if the previous player changed the suit (consecutive suit change)
    if (state && playerId && state.lastSuitChangedBy) {
      // Get the previous player
      const previousPlayer = this.getPreviousPlayerInDirection(state, state.turnDirection);
      
      // If the last suit changer was the previous player, current player cannot change suit
      if (state.lastSuitChangedBy === previousPlayer) {
        // Second consecutive player - suit change is blocked
        return {
          event: {
            type: 'suit-changed',
            payload: { suit: card.suit }, // Use card's natural suit
          },
          stateChanges: {
            currentSuit: card.suit, // Keep the card's suit, don't apply chosen suit
            // Don't update lastSuitChangedBy since suit wasn't actually changed
          },
        };
      }
    }

    // Normal suit change (first player or third+ player)
    return {
      event: {
        type: 'suit-changed',
        payload: { suit: chosenSuit },
      },
      stateChanges: {
        currentSuit: chosenSuit,
        lastSuitChangedBy: playerId, // Track who changed the suit
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

  /**
   * Get previous player in a specific direction
   */
  private static getPreviousPlayerInDirection(state: GameState, direction: 'clockwise' | 'counterclockwise'): string {
    const currentIndex = state.players.findIndex(p => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    // Previous is opposite of the given direction
    const directionModifier = direction === 'clockwise' ? -1 : 1;
    const prevIndex = (currentIndex + directionModifier + state.players.length) % state.players.length;
    
    return state.players[prevIndex].id;
  }
}
