import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameStore } from './types';
import { initialState } from './types';
import { createSocketConnection } from './connection';
import { clearActiveBlunderTimers } from './event-handlers';
import * as actions from './socket-actions';

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
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
        clearActiveBlunderTimers();
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
      
      noRevert: () => actions.noRevert(get, set),

      setGameState: (state: Partial<GameStore>) => {
        set(state);
      },

      clearBlunderTimers: () => {
        clearActiveBlunderTimers();
      },
    }),
    {
      name: 'crazy-user-info',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ username: state.username, avatar: state.avatar } as any),
    }
  )
);

export type { GameStore } from './types';
