import type { GameStore } from './types';

const STORAGE_KEY = 'crazy-game-state';

/**
 * Save game state to sessionStorage
 */
export const saveStateToStorage = (state: Partial<GameStore>) => {
  if (typeof window === 'undefined') return;
  try {
    const stateToSave = {
      username: state.username,
      avatar: state.avatar,
      playerId: state.playerId,
      playerToken: state.playerToken,
      roomId: state.roomId,
      isCreator: state.isCreator,
      creatorId: state.creatorId,
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
      isFinished: state.isFinished,
      myRank: state.myRank,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

/**
 * Restore game state from sessionStorage
 */
export const restoreStateFromStorage = (): Partial<GameStore> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
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
  sessionStorage.removeItem(STORAGE_KEY);
};
