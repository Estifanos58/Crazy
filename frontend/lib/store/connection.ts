import { io, Socket } from 'socket.io-client';
import type { GameStore } from './types';
import { saveStateToStorage, restoreStateFromStorage } from './storage';
import { setupPlayerEvents, setupGameStateEvents, setupGameEventHandlers } from './event-handlers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

type SetState = (state: Partial<GameStore>) => void;
type GetState = () => GameStore;

/**
 * Create and configure socket connection
 */
export const createSocketConnection = (set: SetState, get: GetState): Socket => {
  const socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    upgrade: true,
  });

  // Setup connection events
  setupConnectionEvents(socket, set, get);
  
  // Setup player events
  setupPlayerEvents(socket, set, get);
  
  // Setup game state events
  setupGameStateEvents(socket, set, get);
  
  // Setup game event handlers
  setupGameEventHandlers(socket, set, get);

  return socket;
};

/**
 * Setup connection-related event handlers
 */
const setupConnectionEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    set({ socket, isConnected: true });
    
    // Restore state after reconnection
    restoreSession(socket, set, get);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from server. Reason:', reason);
    set({ isConnected: false });
    saveStateToStorage(get());
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 Reconnection attempt', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Reconnection failed');
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    console.log('🔄 Attempting to reconnect...');
  });
};

/**
 * Restore session from storage after reconnection
 */
const restoreSession = (socket: Socket, set: SetState, get: GetState) => {
  const savedState = restoreStateFromStorage();
  
  if (!savedState || !savedState.roomId) return;
  
  console.log('🔄 Attempting to restore session...');
  const { username, avatar, roomId, isCreator } = savedState;
  
  // Immediately restore local state
  set({
    username,
    avatar,
    roomId,
    isCreator,
    gameStarted: savedState.gameStarted || false,
    yourCards: savedState.yourCards || [],
    currentTurn: savedState.currentTurn || null,
    currentSuit: savedState.currentSuit || null,
    topCard: savedState.topCard || null,
    punishmentChain: savedState.punishmentChain || null,
    players: savedState.players || [],
    activePlayers: savedState.activePlayers || [],
    finishedPlayers: savedState.finishedPlayers || [],
    gameOver: savedState.gameOver || false,
    lastPlayerId: savedState.lastPlayerId || null,
  });
  console.log('✅ Local state restored from storage');
  
  // Try to rejoin the room
  socket.emit('rejoin-room', { roomId, username, avatar }, (response: any) => {
    if (response.success) {
      console.log('✅ Session restored successfully');
      set({
        username,
        avatar,
        roomId,
        isCreator,
        room: response.room,
        players: response.room.players,
        gameStarted: response.room.gameStarted || false,
      });
      
      // If game was started, request game state
      if (response.room.gameStarted) {
        requestGameState(socket, roomId, set, get);
      }
    } else {
      console.log('⚠️ Could not restore session:', response.error);
      sessionStorage.removeItem('crazy-game-state');
    }
  });
};

/**
 * Request current game state from server
 */
const requestGameState = (socket: Socket, roomId: string, set: SetState, get: GetState) => {
  socket.emit('get-game-state', { roomId }, (stateResponse: any) => {
    if (stateResponse.success) {
      const data = stateResponse.gameState;
      console.log('🎮 Game state restored:', data);
      set({
        gameStarted: true,
        yourCards: data.yourCards || [],
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players || [],
        activePlayers: (data.players || []).filter((p: any) => 
          p.cardCount > 0 && !get().finishedPlayers.some(fp => fp.id === p.id)
        ),
        gameOver: data.gameOver || false,
      });
      
      saveStateToStorage(get());
    } else {
      console.error('Failed to get game state:', stateResponse.error);
    }
  });
};
