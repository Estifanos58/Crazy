import type { Card } from '@/types/game.types';
import type { GameStore } from './types';
import { saveStateToStorage } from './storage';

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
      if (response.success) {
        const newState = {
          roomId: response.room.roomId,
          room: response.room,
          isCreator: true,
          players: response.room.players,
          username,
          avatar,
        };
        set(newState);
        saveStateToStorage(newState);
        resolve({ success: true, roomId: response.room.roomId });
      } else {
        resolve({ success: false, error: response.error });
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
      if (response.success) {
        const newState = {
          roomId: response.room.roomId,
          room: response.room,
          isCreator: false,
          players: response.room.players,
          username,
          avatar,
        };
        set(newState);
        saveStateToStorage(newState);
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * Start game action
 */
export const startGame = (get: GetState, cardsPerPlayer: number, customRules?: string): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('start-game', { roomId, cardsPerPlayer, customRules }, (response: any) => {
      if (response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * Play card action
 */
export const playCard = (get: GetState, cards: Card[], chosenSuit?: string): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('play-card', { roomId, cards, chosenSuit }, (response: any) => {
      if (response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * Take punishment action
 */
export const takePunishment = (get: GetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('take-punishment', { roomId }, (response: any) => {
      if (response.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * Call crazy action
 */
export const callCrazy = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('call-crazy', { roomId }, (response: any) => {
      if (response.success) {
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * Revert blunder action
 */
export const revertBlunder = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId, blunderCards } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('revert-blunder', { roomId, cards: blunderCards }, (response: any) => {
      if (response.success) {
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};

/**
 * No revert action (called when timeout expires)
 */
export const noRevert = (get: GetState, set: SetState): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const { socket, roomId } = get();
    
    if (!socket || !roomId) {
      resolve({ success: false, error: 'Not in a room' });
      return;
    }

    socket.emit('no-revert', { roomId }, (response: any) => {
      if (response.success) {
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: response.error });
      }
    });
  });
};
