import type { Card, Suit } from '@/types/game.types';
import type { GameStore } from './types';
import { saveStateToStorage } from './storage';
import { clearActiveBlunderTimers } from './event-handlers';

type GetState = () => GameStore;
type SetState = (state: Partial<GameStore>) => void;

/**
 * Create room action
 */
export const createRoom = (get: GetState, set: SetState): Promise<{ success: boolean; roomId?: string; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, username, avatar } = get();
    
    if (!socket || !username || !avatar) {
      resolve({ success: false, error: 'Missing required information' });
      return;
    }

    socket.emit('create-room', { username, avatar }, (response: any) => {
      if (response && response.success) {
        const newState: Partial<GameStore> = {
          roomId: response.room.roomId,
          room: response.room,
          isCreator: true,
          creatorId: response.playerId,
          playerId: response.playerId,
          playerToken: response.playerToken,
          players: response.room.players,
          username,
          avatar,
        };
        set(newState);
        saveStateToStorage(newState);
        resolve({ success: true, roomId: response.room.roomId });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to create room' });
      }
    });
  });
};

/**
 * Join room action
 */
export const joinRoom = (get: GetState, set: SetState, roomId: string): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, username, avatar } = get();
    
    if (!socket || !username || !avatar) {
      resolve({ success: false, error: 'Missing required information' });
      return;
    }

    socket.emit('join-room', { roomId, username, avatar }, (response: any) => {
      if (response && response.success) {
        const isCreator = response.room?.creatorId === response.playerId;
        const newState: Partial<GameStore> = {
          roomId: response.room.roomId,
          room: response.room,
          isCreator,
          creatorId: response.room.creatorId,
          playerId: response.playerId,
          playerToken: response.playerToken,
          players: response.room.players,
          username,
          avatar,
        };
        set(newState);
        saveStateToStorage(newState);
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to join room' });
      }
    });
  });
};

/**
 * Start game action
 */
export const startGame = (get: GetState, cardsPerPlayer: number, customRules?: string): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('start-game', { roomId, playerId, playerToken, cardsPerPlayer, customRules }, (response: any) => {
      if (response && response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to start game' });
      }
    });
  });
};

/**
 * Play card action
 */
export const playCard = (get: GetState, cards: Card[], chosenSuit?: Suit): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('play-card', { roomId, playerId, playerToken, cards, chosenSuit }, (response: any) => {
      if (response && response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to play card' });
      }
    });
  });
};

/**
 * Take punishment action
 */
export const takePunishment = (get: GetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('take-punishment', { roomId, playerId, playerToken }, (response: any) => {
      if (response && response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to draw card' });
      }
    });
  });
};

/**
 * Call crazy action
 */
export const callCrazy = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('call-crazy', { roomId, playerId, playerToken }, (response: any) => {
      if (response && response.success) {
        clearActiveBlunderTimers();
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to call crazy' });
      }
    });
  });
};

/**
 * Revert blunder action
 */
export const revertBlunder = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken, blunderCards } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('revert-blunder', { roomId, playerId, playerToken, cards: blunderCards }, (response: any) => {
      if (response && response.success) {
        clearActiveBlunderTimers();
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to revert blunder' });
      }
    });
  });
};

/**
 * No revert action
 */
export const noRevert = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, playerId, playerToken } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('no-revert', { roomId, playerId, playerToken }, (response: any) => {
      if (response && response.success) {
        clearActiveBlunderTimers();
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response?.error || 'Failed to process timeout' });
      }
    });
  });
};
