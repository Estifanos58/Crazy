import type { GameState, TurnDirection } from '../../types/game.types';

/**
 * GameStateManager - Handles game state cloning and turn progression
 */
export class GameStateManager {
  /**
   * Clone game state (avoid mutations)
   */
  static cloneState(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        cards: [...p.cards],
      })),
      deck: [...state.deck],
      pile: [...state.pile],
      punishmentChain: {
        ...state.punishmentChain,
        cards: [...state.punishmentChain.cards],
      },
    };
  }

  /**
   * Get next player in turn order (ignoring card counts)
   */
  static getNextPlayer(state: GameState): string {
    if (state.players.length === 0) return '';
    const currentIndex = state.players.findIndex((p) => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    const direction = state.turnDirection === 'clockwise' ? 1 : -1;
    const nextIndex = (currentIndex + direction + state.players.length) % state.players.length;

    return state.players[nextIndex].id;
  }

  /**
   * Get previous player in turn order
   */
  static getPreviousPlayer(state: GameState): string {
    if (state.players.length === 0) return '';
    const currentIndex = state.players.findIndex((p) => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    const direction = state.turnDirection === 'clockwise' ? -1 : 1;
    const prevIndex = (currentIndex + direction + state.players.length) % state.players.length;

    return state.players[prevIndex].id;
  }

  /**
   * Advance to next active player's turn
   */
  static advanceTurn(state: GameState): void {
    state.currentTurn = this.getNextActivePlayerFrom(state, state.currentTurn, 1);
  }

  /**
   * Skip one active player and advance turn
   */
  static skipAndAdvanceTurn(state: GameState): void {
    state.currentTurn = this.getNextActivePlayerFrom(state, state.currentTurn, 2);
  }

  /**
   * Advance `steps` active players from `fromPlayerId` in `direction` (default: state.turnDirection).
   * When `winOnEmpty` is true (default), skips players who have 0 cards.
   * When `winOnEmpty` is false, all players in `state.players` remain active in turn order.
   */
  static getNextActivePlayerFrom(
    state: GameState,
    fromPlayerId: string,
    steps = 1,
    directionOverride?: TurnDirection
  ): string {
    if (state.players.length === 0) return '';

    const winOnEmpty = state.ruleConfig?.winOnEmpty ?? true;
    const isActive = (p: GameState['players'][number]) =>
      winOnEmpty ? p.cards.length > 0 : p.finishedAt === undefined;

    const activePlayers = state.players.filter(isActive);
    if (activePlayers.length === 0) {
      return state.players[0].id;
    }

    const startIndex = state.players.findIndex((p) => p.id === fromPlayerId);
    if (startIndex === -1) {
      return activePlayers[0].id;
    }

    const direction = (directionOverride ?? state.turnDirection) === 'clockwise' ? 1 : -1;
    let cursor = startIndex;
    let remainingSteps = Math.max(1, steps);
    let safety = 0;
    const maxIterations = state.players.length * (remainingSteps + 2);

    while (remainingSteps > 0 && safety < maxIterations) {
      cursor = (cursor + direction + state.players.length) % state.players.length;
      safety += 1;
      if (isActive(state.players[cursor])) {
        remainingSteps -= 1;
      }
    }

    return state.players[cursor].id;
  }

  /**
   * Backwards-compatible helper: get next active player from currentTurn
   */
  static getNextActivePlayer(state: GameState): string {
    return this.getNextActivePlayerFrom(state, state.currentTurn, 1);
  }
}
