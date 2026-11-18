import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GameStore, StartGameOptions } from './types';
import { initialRoomState, initialState } from './types';
import { createSocketConnection } from './connection';
import { clearActiveBlunderTimers } from './event-handlers';
import { clearSessionFromStorage } from './storage';
import * as actions from './socket-actions';

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      connect: () => {
        const existingSocket = get().socket;
        if (existingSocket && (existingSocket.connected || existingSocket.active)) {
          return;
        }

        if (existingSocket) {
          existingSocket.disconnect();
        }

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
        set({ username: username.trim(), avatar });
      },

      createRoom: () => actions.createRoom(get, set),

      joinRoom: (roomId: string) => actions.joinRoom(get, set, roomId),

      rejoinRoom: (roomId: string) => actions.rejoinRoom(get, set, roomId),

      fetchGameState: (roomId: string) => actions.fetchGameState(get, set, roomId),

      startGame: (cardsPerPlayer: number, options?: StartGameOptions) =>
        actions.startGame(get, cardsPerPlayer, options),

      playCard: (cards, chosenSuit) => actions.playCard(get, cards, chosenSuit),

      takePunishment: () => actions.takePunishment(get),

      callCrazy: () => actions.callCrazy(get, set),

      revertBlunder: () => actions.revertBlunder(get, set),

      playAgain: () => actions.playAgain(get, set),

      leaveGame: (terminateIfHost?: boolean) => actions.leaveGame(get, set, terminateIfHost),

      setGameState: (state: Partial<GameStore>) => {
        set(state);
      },

      resetRoomState: () => {
        clearActiveBlunderTimers();
        clearSessionFromStorage();
        set({ ...initialRoomState });
      },

      clearBlunderTimers: () => {
        clearActiveBlunderTimers();
      },
    }),
    {
      name: 'crazy-user-info',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ username: state.username, avatar: state.avatar }),
    }
  )
);

export type { GameStore, StartGameOptions } from './types';
