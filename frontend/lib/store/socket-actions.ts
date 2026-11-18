import type { Socket } from 'socket.io-client';
import type {
  Card,
  CreateRoomResponse,
  GetGameStateResponse,
  JoinRoomResponse,
  RejoinRoomResponse,
  StandardResponse,
  Suit,
} from '@/types/game.types';
import type { GameStore, StartGameOptions } from './types';
import { initialRoomState } from './types';
import {
  clearSessionFromStorage,
  restoreSessionFromStorage,
  saveSessionToStorage,
} from './storage';
import { clearActiveBlunderTimers, startBlunderCountdown } from './event-handlers';

type GetState = () => GameStore;
type SetState = (state: Partial<GameStore>) => void;

const DEFAULT_ACK_TIMEOUT_MS = 8000;

/**
 * Emit a Socket.IO event with a guaranteed acknowledgement timeout so promises never hang.
 */
export function emitWithAck<TRes extends { success?: boolean; error?: string }>(
  socket: Socket | null,
  event: string,
  payload: unknown,
  timeoutMs = DEFAULT_ACK_TIMEOUT_MS
): Promise<TRes> {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ success: false, error: 'Not connected to the game server' } as TRes);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          success: false,
          error: 'Server did not respond in time. Please try again.',
        } as TRes);
      }
    }, timeoutMs);

    socket.emit(event, payload, (response: TRes) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(response || ({ success: false, error: 'Empty server response' } as TRes));
      }
    });
  });
}

export const applyAuthoritativeGameState = (
  data: NonNullable<GetGameStateResponse['gameState']>,
  set: SetState,
  get: GetState
) => {
  const { playerId } = get();
  const isFinished = Boolean(data.isFinished);
  const myRank = data.rank ?? null;

  clearActiveBlunderTimers();

  const blunder = data.blunderState;
  const isMyBlunder = Boolean(blunder?.active && playerId && blunder.playerId === playerId);

  set({
    roomId: data.roomId,
    creatorId: data.creatorId,
    isCreator: Boolean(playerId && data.creatorId === playerId),
    gameStarted: data.gameStarted,
    gameOver: data.gameOver,
    yourCards: data.yourCards || [],
    currentTurn: data.currentTurn || null,
    currentSuit: data.currentSuit || null,
    turnDirection: data.turnDirection || 'clockwise',
    topCard: data.topCard || null,
    punishmentChain: data.punishmentChain || null,
    players: data.players || [],
    activePlayers: data.players || [],
    finishedPlayers: data.finishedPlayers || [],
    drawCount: data.drawCount || 0,
    deckCount: data.deckCount || 0,
    pileCount: data.pileCount || 0,
    ruleConfig: data.ruleConfig || null,
    isFinished,
    myRank,
    blunderActive: isMyBlunder,
    blunderReason: blunder?.active ? blunder.reason : null,
    blunderPlayerId: blunder?.active ? blunder.playerId : null,
    blunderCards: blunder?.active ? blunder.cards || [] : [],
    blunderTimeLeft: blunder?.active ? blunder.timeLeft : 0,
    blunderTotalTime: isMyBlunder ? 5 : 8,
  });

  if (blunder?.active && blunder.timeLeft > 0) {
    startBlunderCountdown(blunder.timeLeft, blunder.playerId, isMyBlunder, set, get);
  }
};

export const fetchGameState = async (
  get: GetState,
  set: SetState,
  roomId: string
): Promise<{ success: boolean; error?: string }> => {
  const { socket, playerId, playerToken } = get();
  if (!socket || !socket.connected) {
    return { success: false, error: 'Not connected to server' };
  }

  const response = await emitWithAck<GetGameStateResponse>(socket, 'get-game-state', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
  });

  if (response.success && response.gameState) {
    applyAuthoritativeGameState(response.gameState, set, get);
    return { success: true };
  }

  return { success: false, error: response.error || 'Failed to sync game state' };
};

export const createRoom = async (
  get: GetState,
  set: SetState
): Promise<{ success: boolean; roomId?: string; error?: string }> => {
  const { socket, username, avatar } = get();
  if (!socket || !socket.connected) {
    return { success: false, error: 'Connecting to server. Please try again in a moment.' };
  }
  if (!username.trim() || !avatar) {
    return { success: false, error: 'Please enter a username and choose an avatar' };
  }

  const response = await emitWithAck<CreateRoomResponse>(socket, 'create-room', {
    username: username.trim(),
    avatar,
  });

  if (response.success && response.room && response.playerId && response.playerToken) {
    set({
      ...initialRoomState,
      roomId: response.room.roomId,
      room: response.room,
      isCreator: true,
      creatorId: response.room.creatorId,
      playerId: response.playerId,
      playerToken: response.playerToken,
      players: response.room.players,
      activePlayers: response.room.players,
      username: username.trim(),
      avatar,
    });

    saveSessionToStorage({
      roomId: response.room.roomId,
      playerId: response.playerId,
      playerToken: response.playerToken,
      username: username.trim(),
      avatar,
    });

    return { success: true, roomId: response.room.roomId };
  }

  return { success: false, error: response.error || 'Failed to create room' };
};

export const joinRoom = async (
  get: GetState,
  set: SetState,
  roomId: string
): Promise<{ success: boolean; error?: string }> => {
  const { socket, username, avatar } = get();
  if (!socket || !socket.connected) {
    return { success: false, error: 'Connecting to server. Please try again in a moment.' };
  }
  if (!username.trim() || !avatar) {
    return { success: false, error: 'Please enter a username and choose an avatar' };
  }

  const response = await emitWithAck<JoinRoomResponse>(socket, 'join-room', {
    roomId: roomId.trim(),
    username: username.trim(),
    avatar,
  });

  if (response.success && response.room && response.playerId && response.playerToken) {
    const isCreator = response.room.creatorId === response.playerId;
    set({
      ...initialRoomState,
      roomId: response.room.roomId,
      room: response.room,
      isCreator,
      creatorId: response.room.creatorId,
      playerId: response.playerId,
      playerToken: response.playerToken,
      players: response.room.players,
      activePlayers: response.room.players,
      gameStarted: response.room.gameStarted,
      gameOver: Boolean(response.room.gameOver),
      username: username.trim(),
      avatar,
    });

    saveSessionToStorage({
      roomId: response.room.roomId,
      playerId: response.playerId,
      playerToken: response.playerToken,
      username: username.trim(),
      avatar,
    });

    return { success: true };
  }

  return { success: false, error: response.error || 'Failed to join room' };
};

export const rejoinRoom = async (
  get: GetState,
  set: SetState,
  roomId: string
): Promise<{ success: boolean; error?: string }> => {
  const state = get();
  const saved = restoreSessionFromStorage();
  const activePlayerId = state.playerId || (saved?.roomId === roomId ? saved.playerId : null);
  const activePlayerToken =
    state.playerToken || (saved?.roomId === roomId ? saved.playerToken : null);

  if (!activePlayerId || !activePlayerToken) {
    return { success: false, error: 'No stored session credentials for this room' };
  }

  const response = await emitWithAck<RejoinRoomResponse>(state.socket, 'rejoin-room', {
    roomId,
    playerId: activePlayerId,
    playerToken: activePlayerToken,
  });

  if (response.success && response.room && response.playerId && response.playerToken) {
    const isCreator = response.room.creatorId === response.playerId;
    const username = state.username || saved?.username || '';
    const avatar = state.avatar || saved?.avatar || '';

    set({
      roomId: response.room.roomId,
      room: response.room,
      playerId: response.playerId,
      playerToken: response.playerToken,
      isCreator,
      creatorId: response.room.creatorId,
      players: response.room.players,
      activePlayers: response.room.players,
      finishedPlayers: response.room.finishedPlayers || [],
      gameStarted: response.room.gameStarted,
      gameOver: Boolean(response.room.gameOver),
      ruleConfig: response.room.ruleConfig || null,
      username,
      avatar,
      terminatedMessage: null,
    });

    saveSessionToStorage({
      roomId: response.room.roomId,
      playerId: response.playerId,
      playerToken: response.playerToken,
      username,
      avatar,
    });

    if (response.room.gameStarted || response.room.gameOver) {
      await fetchGameState(get, set, response.room.roomId);
    }

    return { success: true };
  }

  return { success: false, error: response.error || 'Could not restore session' };
};

export const startGame = async (
  get: GetState,
  cardsPerPlayer: number,
  options?: StartGameOptions
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'start-game', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
    cardsPerPlayer,
    customRules: options?.customRules?.trim() || undefined,
    rulePreset: options?.rulePreset,
    ruleConfig: options?.ruleConfig,
  });

  if (response.success) {
    return { success: true };
  }
  return { success: false, error: response.error || 'Failed to start game' };
};

export const playCard = async (
  get: GetState,
  cards: Card[],
  chosenSuit?: Suit
): Promise<{ success: boolean; isBlunder?: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'play-card', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
    cards,
    chosenSuit,
  });

  if (response.success) {
    return { success: true, isBlunder: response.isBlunder };
  }
  return { success: false, error: response.error || 'Failed to play card' };
};

export const takePunishment = async (
  get: GetState
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'take-punishment', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
  });

  if (response.success) {
    return { success: true };
  }
  return { success: false, error: response.error || 'Failed to draw card' };
};

export const callCrazy = async (
  get: GetState,
  set: SetState
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'call-crazy', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
  });

  if (response.success) {
    clearActiveBlunderTimers();
    set({
      blunderActive: false,
      blunderReason: null,
      blunderPlayerId: null,
      blunderCards: [],
      blunderTimeLeft: 0,
    });
    return { success: true };
  }
  return { success: false, error: response.error || 'Failed to call Crazy' };
};

export const revertBlunder = async (
  get: GetState,
  set: SetState
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'revert-blunder', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
  });

  if (response.success) {
    clearActiveBlunderTimers();
    set({
      blunderActive: false,
      blunderReason: null,
      blunderPlayerId: null,
      blunderCards: [],
      blunderTimeLeft: 0,
    });
    return { success: true };
  }
  return { success: false, error: response.error || 'Failed to revert blunder' };
};

export const playAgain = async (
  get: GetState,
  set: SetState
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, playerId, playerToken } = get();
  if (!socket || !roomId) {
    return { success: false, error: 'Not in a room' };
  }

  const response = await emitWithAck<StandardResponse>(socket, 'play-again', {
    roomId,
    playerId: playerId || undefined,
    playerToken: playerToken || undefined,
  });

  if (response.success) {
    set({ gameOver: false, isFinished: false, myRank: null });
    return { success: true };
  }
  return { success: false, error: response.error || 'Failed to start new match' };
};

export const leaveGame = async (
  get: GetState,
  set: SetState,
  terminateIfHost?: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { socket, roomId, isCreator, playerId, playerToken } = get();

  if (socket && socket.connected && roomId) {
    await emitWithAck<StandardResponse>(
      socket,
      'leave-game',
      {
        roomId,
        isCreator: terminateIfHost ?? isCreator,
        playerId: playerId || undefined,
        playerToken: playerToken || undefined,
      },
      3000
    );
  }

  clearActiveBlunderTimers();
  clearSessionFromStorage();
  set({ ...initialRoomState });
  return { success: true };
};
