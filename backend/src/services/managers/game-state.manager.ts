import type { GameState } from '../../types/game.types';

/**
 * GameStateManager - Handles game state operations
 */
export class GameStateManager {
  /**
   * Clone game state (avoid mutations)
   */
  static cloneState(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map(p => ({
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
   * Get next player in turn order
   */
  static getNextPlayer(state: GameState): string {
    const currentIndex = state.players.findIndex(p => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    const direction = state.turnDirection === 'clockwise' ? 1 : -1;
    const nextIndex = (currentIndex + direction + state.players.length) % state.players.length;
    
    return state.players[nextIndex].id;
  }

  /**
   * Get previous player in turn order (used for reverse card effect)
   * Per rules: when reverse is played, the previous player continues
   */
  static getPreviousPlayer(state: GameState): string {
    const currentIndex = state.players.findIndex(p => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    // Previous player is opposite of current direction
    const direction = state.turnDirection === 'clockwise' ? -1 : 1;
    const prevIndex = (currentIndex + direction + state.players.length) % state.players.length;
    
    return state.players[prevIndex].id;
  }

  /**
   * Advance to next player's turn
   */
  static advanceTurn(state: GameState): void {
    state.currentTurn = this.getNextPlayer(state);
  }

  /**
   * Skip one player and advance turn
   */
  static skipAndAdvanceTurn(state: GameState): void {
    // Advance once to skip current next player
    state.currentTurn = this.getNextPlayer(state);
    // Advance again to land on the player after skipped one
    state.currentTurn = this.getNextPlayer(state);
  }
}
