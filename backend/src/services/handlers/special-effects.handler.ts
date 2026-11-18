import type { Card, GameEvent, GameState, RuleConfig, Suit } from '../../types/game.types';
import { matchesAnyCardSelector } from '../../utils/card-selector';
import { GameStateManager } from '../managers/game-state.manager';

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
    multipleCards = false,
    playerId?: string,
    activePlayerCountBeforeFinish?: number
  ): {
    events: GameEvent[];
    stateChanges: Partial<GameState>;
    isReverse: boolean;
    isSkip: boolean;
    reverseActsAsSkip: boolean;
  } {
    const events: GameEvent[] = [];
    const stateChanges: Partial<GameState> = {};
    let isReverse = false;
    let isSkip = false;
    let reverseActsAsSkip = false;

    const actingPlayerId = playerId || state.currentTurn;
    const activeCount =
      activePlayerCountBeforeFinish ??
      state.players.filter((p) => p.cards.length > 0 || p.id === actingPlayerId).length;

    // When multiple cards are played, reverse and skip effects should NOT trigger
    if (!multipleCards) {
      // Check and apply reverse
      const reverseEffect = this.checkReverse(card, state, config, actingPlayerId, activeCount);
      if (reverseEffect) {
        events.push(...reverseEffect.events);
        Object.assign(stateChanges, reverseEffect.stateChanges);
        isReverse = true;
        reverseActsAsSkip = reverseEffect.actsAsSkip;
      }

      // Check and apply skip
      const skipEffect = this.checkSkip(card, state, config, actingPlayerId);
      if (skipEffect) {
        events.push(skipEffect.event);
        Object.assign(stateChanges, skipEffect.stateChanges);
        isSkip = true;
      }
    }

    // Check and apply suit change (with consecutive tracking)
    const suitChangeEffect = this.checkSuitChange(card, config, chosenSuit, state, actingPlayerId);
    if (suitChangeEffect) {
      events.push(suitChangeEffect.event);
      Object.assign(stateChanges, suitChangeEffect.stateChanges);
    } else {
      // Clear consecutive suit-change tracker when a non-suit-change card is played
      stateChanges.lastSuitChangedBy = undefined;
    }

    return { events, stateChanges, isReverse, isSkip, reverseActsAsSkip };
  }

  /**
   * Check and handle reverse effect.
   * Per rules:
   * - In 3+ player games: reverses turn direction; next turn goes to previous active player.
   * - In 2-player games: reverses direction AND acts as a skip (acting player goes again).
   */
  private static checkReverse(
    card: Card,
    state: GameState,
    config: RuleConfig,
    actingPlayerId: string,
    activePlayerCount: number
  ): { events: GameEvent[]; stateChanges: Partial<GameState>; actsAsSkip: boolean } | null {
    const isReverse = matchesAnyCardSelector(card, config.specialCards.reverseCards);
    if (!isReverse) return null;

    const newDirection = state.turnDirection === 'clockwise' ? 'counterclockwise' : 'clockwise';
    const events: GameEvent[] = [
      {
        type: 'turn-reversed',
        payload: { direction: newDirection },
      },
    ];

    const actsAsSkip = activePlayerCount === 2;
    if (actsAsSkip) {
      const skippedPlayerId = GameStateManager.getNextActivePlayerFrom(state, actingPlayerId, 1);
      if (skippedPlayerId && skippedPlayerId !== actingPlayerId) {
        events.push({
          type: 'player-skipped',
          payload: { playerId: skippedPlayerId },
        });
      }
    }

    return {
      events,
      stateChanges: {
        turnDirection: newDirection,
      },
      actsAsSkip,
    };
  }

  /**
   * Check and handle skip effect
   */
  private static checkSkip(
    card: Card,
    state: GameState,
    config: RuleConfig,
    actingPlayerId: string
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isSkip = matchesAnyCardSelector(card, config.specialCards.skipCards);
    if (!isSkip) return null;

    const skippedPlayerId = GameStateManager.getNextActivePlayerFrom(state, actingPlayerId, 1);

    return {
      event: {
        type: 'player-skipped',
        payload: { playerId: skippedPlayerId },
      },
      stateChanges: {},
    };
  }

  /**
   * Check and handle suit change effect.
   * Rule: If player A changes suit, player B (next) cannot change suit,
   * but player C (third) can change suit again.
   */
  private static checkSuitChange(
    card: Card,
    config: RuleConfig,
    chosenSuit?: Suit,
    state?: GameState,
    playerId?: string
  ): { event: GameEvent; stateChanges: Partial<GameState> } | null {
    const isSuitChange = matchesAnyCardSelector(card, config.specialCards.suitChangeCards);
    if (!isSuitChange || !chosenSuit) return null;

    // Check if the previous player changed the suit (consecutive suit change)
    if (state && playerId && state.lastSuitChangedBy) {
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex !== -1) {
        const directionModifier = state.turnDirection === 'clockwise' ? -1 : 1;
        const prevIndex =
          (playerIndex + directionModifier + state.players.length) % state.players.length;
        const previousPlayer = state.players[prevIndex].id;

        if (state.lastSuitChangedBy === previousPlayer) {
          // Second consecutive player - suit change is blocked
          return {
            event: {
              type: 'suit-changed',
              payload: { suit: card.suit },
            },
            stateChanges: {
              currentSuit: card.suit,
              lastSuitChangedBy: undefined,
            },
          };
        }
      }
    }

    // Normal suit change
    return {
      event: {
        type: 'suit-changed',
        payload: { suit: chosenSuit },
      },
      stateChanges: {
        currentSuit: chosenSuit,
        lastSuitChangedBy: playerId,
      },
    };
  }
}
