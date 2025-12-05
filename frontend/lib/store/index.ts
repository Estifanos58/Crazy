import { create } from 'zustand';
import type { GameStore } from './types';
import { initialState } from './types';
import { createSocketConnection } from './connection';
import * as actions from './socket-actions';

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  connect: () => {
    // Prevent duplicate connections
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.connected) {
      console.log('⚠️ Socket already connected');
      return;
    }

    // Disconnect existing socket if any
    if (existingSocket) {
      existingSocket.disconnect();
    }

    console.log('🔌 Connecting to server...');
    const socket = createSocketConnection(set, get);
    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setUserInfo: (username: string, avatar: string) => {
    set({ username, avatar });
  },

  createRoom: () => actions.createRoom(get, set),
  
  joinRoom: (roomId: string) => actions.joinRoom(get, set, roomId),
  
  startGame: (cardsPerPlayer: number, customRules?: string) => 
    actions.startGame(get, cardsPerPlayer, customRules),
  
  playCard: (cards, chosenSuit) => actions.playCard(get, cards, chosenSuit),
  
  takePunishment: () => actions.takePunishment(get),
  
  callCrazy: () => actions.callCrazy(get, set),
  
  revertBlunder: () => actions.revertBlunder(get, set),

  setGameState: (state: Partial<GameStore>) => {
    set(state);
  },
}));

// Re-export types
export type { GameStore } from './types';
