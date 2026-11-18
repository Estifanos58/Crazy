import { io, Socket } from 'socket.io-client';
import type { GameStore } from './types';
import { initialRoomState } from './types';
import { clearSessionFromStorage, restoreSessionFromStorage } from './storage';
import { setupGameEventHandlers, setupGameStateEvents, setupPlayerEvents } from './event-handlers';
import { rejoinRoom } from './socket-actions';

function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }
  return 'http://localhost:3001';
}

type SetState = (state: Partial<GameStore>) => void;
type GetState = () => GameStore;

export const createSocketConnection = (set: SetState, get: GetState): Socket => {
  const socket = io(getBackendUrl(), {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 15000,
    transports: ['websocket', 'polling'],
    upgrade: true,
  });

  setupConnectionEvents(socket, set, get);
  setupPlayerEvents(socket, set, get);
  setupGameStateEvents(socket, set, get);
  setupGameEventHandlers(socket, set, get);

  return socket;
};

const setupConnectionEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('connect', async () => {
    set({ socket, isConnected: true });

    const currentState = get();
    const savedSession = restoreSessionFromStorage();
    const targetRoomId = currentState.roomId || savedSession?.roomId;

    if (!targetRoomId) {
      return;
    }

    const hasCredentials = Boolean(
      (currentState.playerId && currentState.playerToken) ||
        (savedSession && savedSession.roomId === targetRoomId)
    );

    if (!hasCredentials) {
      return;
    }

    set({ isRestoringSession: true });
    try {
      const result = await rejoinRoom(get, set, targetRoomId);
      if (!result.success) {
        // Session or room is no longer valid — clear stale credentials cleanly
        clearSessionFromStorage();
        set({ ...initialRoomState });
      }
    } finally {
      set({ isRestoringSession: false });
    }
  });

  socket.on('disconnect', () => {
    set({ isConnected: false });
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });
};
