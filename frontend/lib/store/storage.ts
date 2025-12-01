import type { GameStore } from './types';

/**
 * Save game state to sessionStorage
 */
export const saveStateToStorage = (state: Partial<GameStore>) => {
  if (typeof window === 'undefined') return;
  try {
    const stateToSave = {
      username: state.username,
      avatar: state.avatar,
      roomId: state.roomId,
      isCreator: state.isCreator,
      gameStarted: state.gameStarted,
      yourCards: state.yourCards,
      currentTurn: state.currentTurn,
      currentSuit: state.currentSuit,
      topCard: state.topCard,
      punishmentChain: state.punishmentChain,
      players: state.players,
      activePlayers: state.activePlayers,
      finishedPlayers: state.finishedPlayers,
      gameOver: state.gameOver,
      lastPlayerId: state.lastPlayerId,
    };
    sessionStorage.setItem('crazy-game-state', JSON.stringify(stateToSave));
    console.log('💾 State saved to storage');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

/**
 * Restore game state from sessionStorage
 */
export const restoreStateFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('crazy-game-state');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to restore state:', error);
    return null;
  }
};

/**
 * Clear game state from sessionStorage
 */
export const clearStateFromStorage = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('crazy-game-state');
};
