export interface SavedSession {
  roomId: string;
  playerId: string;
  playerToken: string;
  username: string;
  avatar: string;
}

const STORAGE_KEY = 'crazy-game-session';
const LEGACY_STORAGE_KEY = 'crazy-game-state';

/**
 * Save minimal session identity to sessionStorage.
 * Authoritative game state (cards, turn, pile) is ALWAYS synchronized from the server.
 */
export const saveSessionToStorage = (session: Partial<SavedSession>) => {
  if (typeof window === 'undefined') return;
  if (!session.roomId || !session.playerId || !session.playerToken) return;

  try {
    const payload: SavedSession = {
      roomId: session.roomId,
      playerId: session.playerId,
      playerToken: session.playerToken,
      username: session.username || '',
      avatar: session.avatar || '',
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

/**
 * Restore session identity from sessionStorage.
 */
export const restoreSessionFromStorage = (): SavedSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (!parsed.roomId || !parsed.playerId || !parsed.playerToken) {
      return null;
    }
    return {
      roomId: parsed.roomId,
      playerId: parsed.playerId,
      playerToken: parsed.playerToken,
      username: parsed.username || '',
      avatar: parsed.avatar || '',
    };
  } catch (error) {
    console.error('Failed to restore session:', error);
    return null;
  }
};

/**
 * Clear saved session from sessionStorage.
 */
export const clearSessionFromStorage = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
};
