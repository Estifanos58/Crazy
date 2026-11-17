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
    
    // Restore state after connection (both initial and reconnection)
    const savedState = restoreStateFromStorage();
    if (savedState && savedState.roomId) {
      console.log('🔄 Saved state found, attempting to restore session...');
      restoreSession(socket, set, get);
    }
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
  });
};

/**
 * Restore session from storage after reconnection
 */
const restoreSession = (socket: Socket, set: SetState, get: GetState) => {
  const savedState = restoreStateFromStorage();
  
  if (!savedState || !savedState.roomId) return;
  
  const { username, avatar, roomId, isCreator, playerId, playerToken } = savedState;
  
  // Immediately restore local state
  set({
    username,
    avatar,
    roomId,
    playerId: playerId || null,
    playerToken: playerToken || null,
    isCreator: Boolean(isCreator),
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
    isFinished: Boolean(savedState.isFinished),
    myRank: savedState.myRank || null,
  });
  
  // Secure rejoin with stored credentials
  socket.emit(
    'rejoin-room',
    { roomId, playerId, playerToken, username, avatar },
    (response: any) => {
      if (response && response.success) {
        console.log('✅ Session restored successfully');
        const activePid = response.playerId || playerId;
        const activeTok = response.playerToken || playerToken;

        set({
          username,
          avatar,
          roomId,
          playerId: activePid,
          playerToken: activeTok,
          isCreator: response.room?.creatorId === activePid,
          room: response.room,
          players: response.room?.players || [],
          gameStarted: response.room?.gameStarted || false,
          gameOver: response.room?.gameOver || false,
        });
        
        saveStateToStorage(get());

        // If game was started, request latest authoritative game state
        if (response.room?.gameStarted || response.room?.gameOver) {
          requestGameState(socket, roomId, activePid, activeTok, set, get);
          
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/game/')) {
            window.location.href = `/game/${roomId}`;
          }
        } else {
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/room/')) {
            window.location.href = `/room/${roomId}`;
          }
        }
      } else {
        console.log('⚠️ Could not restore session:', response?.error);
      }
    }
  );
};

/**
 * Request current authoritative game state from server
 */
export const requestGameState = (
  socket: Socket,
  roomId: string,
  playerId: string | null | undefined,
  playerToken: string | null | undefined,
  set: SetState,
  get: GetState
) => {
  socket.emit('get-game-state', { roomId, playerId, playerToken }, (stateResponse: any) => {
    if (stateResponse && stateResponse.success) {
      const data = stateResponse.gameState;
      console.log('🎮 Game state restored:', data);
      
      const isFinished = Boolean(data.isFinished);
      const myRank = data.rank || null;

      set({
        gameStarted: !data.gameOver,
        gameOver: data.gameOver || false,
        yourCards: data.yourCards || [],
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players || [],
        activePlayers: data.players || [],
        finishedPlayers: data.finishedPlayers || [],
        drawCount: data.drawCount || 0,
        isFinished,
        myRank,
        blunderActive: data.blunderState?.active || false,
        blunderReason: data.blunderState?.reason || null,
        blunderPlayerId: data.blunderState?.playerId || null,
        blunderTimeLeft: data.blunderState?.timeLeft || 0,
      });
      
      saveStateToStorage(get());
    } else {
      console.error('Failed to get game state:', stateResponse?.error);
    }
  });
};
