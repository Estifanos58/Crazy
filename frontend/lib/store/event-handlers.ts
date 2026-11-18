import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type {
  Card,
  GameEvent,
  GameStartedPayload,
  GameUpdatePayload,
  Player,
  RankedPlayer,
} from '@/types/game.types';
import type { GameStore } from './types';
import { initialRoomState } from './types';
import { clearSessionFromStorage } from './storage';

type SetState = (state: Partial<GameStore>) => void;
type GetState = () => GameStore;

let blunderCountdownInterval: ReturnType<typeof setInterval> | null = null;
let blunderClearTimeout: ReturnType<typeof setTimeout> | null = null;

export const clearActiveBlunderTimers = () => {
  if (blunderCountdownInterval) {
    clearInterval(blunderCountdownInterval);
    blunderCountdownInterval = null;
  }
  if (blunderClearTimeout) {
    clearTimeout(blunderClearTimeout);
    blunderClearTimeout = null;
  }
};

export const startBlunderCountdown = (
  initialSeconds: number,
  targetPlayerId: string,
  isMyBlunder: boolean,
  set: SetState,
  get: GetState
) => {
  clearActiveBlunderTimers();
  let remaining = Math.max(0, Math.ceil(initialSeconds));
  set({ blunderTimeLeft: remaining });

  blunderCountdownInterval = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    set({ blunderTimeLeft: remaining });
    if (remaining <= 0 && blunderCountdownInterval) {
      clearInterval(blunderCountdownInterval);
      blunderCountdownInterval = null;
    }
  }, 1000);

  if (!isMyBlunder) {
    blunderClearTimeout = setTimeout(() => {
      if (get().blunderPlayerId === targetPlayerId) {
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
      }
    }, Math.max(1000, initialSeconds * 1000 + 500));
  }
};

export const setupPlayerEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('player-joined', (data: { player?: Player; players: Player[] }) => {
    const players = data.players || [];
    set({ players, activePlayers: players });
    if (data.player && data.player.id !== get().playerId) {
      toast.info(`${data.player.username} joined the table`);
    }
  });

  socket.on('player-rejoined', (data: { player?: Player; players: Player[] }) => {
    const players = data.players || [];
    set({ players, activePlayers: players });
  });

  socket.on('player-disconnected', (data: { playerId: string; players: Player[] }) => {
    const players = data.players || [];
    set({ players, activePlayers: players });
  });

  socket.on(
    'player-left',
    (data: { username: string; avatar: string; players: Player[]; creatorId?: string }) => {
      const { playerId } = get();
      toast.info(`${data.username} left the table`, { duration: 3500 });
      const players = data.players || [];
      const nextCreatorId = data.creatorId ?? get().creatorId;
      set({
        players,
        activePlayers: players,
        creatorId: nextCreatorId,
        isCreator: Boolean(playerId && nextCreatorId === playerId),
      });
    }
  );
};

export const setupGameStateEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('game-started', (data: GameStartedPayload) => {
    clearActiveBlunderTimers();

    if (get().gameOver) {
      toast.success('New match started', { duration: 3000 });
    }

    set({
      roomId: data.roomId,
      gameStarted: true,
      gameOver: false,
      yourCards: data.yourCards || [],
      currentTurn: data.currentTurn,
      currentSuit: data.currentSuit || null,
      turnDirection: data.turnDirection || 'clockwise',
      topCard: data.topCard || null,
      punishmentChain: data.punishmentChain || null,
      players: data.players || [],
      activePlayers: data.players || [],
      finishedPlayers: [],
      drawCount: 0,
      deckCount: data.deckCount ?? 0,
      pileCount: data.pileCount ?? 0,
      ruleConfig: data.ruleConfig || get().ruleConfig,
      isFinished: false,
      myRank: null,
      blunderActive: false,
      blunderReason: null,
      blunderPlayerId: null,
      blunderCards: [],
      blunderTimeLeft: 0,
      terminatedMessage: null,
    });
  });

  socket.on('game-update', (data: GameUpdatePayload) => {
    const store = get();
    const myId = store.playerId;

    const finishedEntry = myId
      ? data.finishedPlayers?.find((fp) => fp.id === myId)
      : undefined;
    const isFinished = Boolean(finishedEntry);
    const myRank = finishedEntry?.rank ?? null;

    set({
      yourCards: data.yourCards ?? store.yourCards,
      currentTurn: data.currentTurn ?? null,
      currentSuit: data.currentSuit ?? null,
      turnDirection: data.turnDirection || store.turnDirection,
      topCard: data.topCard ?? null,
      punishmentChain: data.punishmentChain ?? null,
      players: data.players || [],
      activePlayers: data.players || [],
      finishedPlayers: data.finishedPlayers || [],
      drawCount: data.drawCount ?? 0,
      deckCount: data.deckCount ?? store.deckCount,
      pileCount: data.pileCount ?? store.pileCount,
      gameOver: Boolean(data.gameOver),
      gameStarted: Boolean(data.gameStarted),
      creatorId: data.creatorId ?? store.creatorId,
      isCreator: Boolean(myId && (data.creatorId ?? store.creatorId) === myId),
      isFinished,
      myRank,
    });
  });

  socket.on('game-terminated', (data: { message?: string }) => {
    clearActiveBlunderTimers();
    clearSessionFromStorage();

    const message = data?.message || 'The host ended this room.';
    toast.error(message, { duration: 4500 });

    set({
      ...initialRoomState,
      terminatedMessage: message,
    });
  });
};

export const setupGameEventHandlers = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('game-event', (event: GameEvent) => {
    const state = get();
    const allKnownPlayers = [...state.players, ...state.finishedPlayers];
    const getPlayerName = (id: string) => {
      if (state.playerId && id === state.playerId) return 'You';
      return allKnownPlayers.find((p) => p.id === id)?.username || 'Player';
    };

    switch (event.type) {
      case 'card-played':
        handleCardPlayed(event.payload, set, getPlayerName);
        break;

      case 'cards_drawn':
        if (event.amount > 0) {
          toast.info(
            `${getPlayerName(event.playerId)} drew ${event.amount} ${event.amount === 1 ? 'card' : 'cards'}`
          );
        }
        break;

      case 'punishment-taken':
        toast.warning(
          `${getPlayerName(event.payload.playerId)} took ${event.payload.amount} penalty ${event.payload.amount === 1 ? 'card' : 'cards'}`
        );
        break;

      case 'punishment-chain-started':
        toast.error(`Punishment chain started (+${event.payload.amount} cards)`);
        break;

      case 'punishment-chain-increased':
        toast.error(`Punishment stacked to +${event.payload.amount} cards`);
        break;

      case 'turn-reversed':
        toast.info(
          `Direction reversed (${event.payload.direction === 'clockwise' ? 'Clockwise' : 'Counter-clockwise'})`
        );
        break;

      case 'player-skipped':
        toast.info(`${getPlayerName(event.payload.playerId)} was skipped`);
        break;

      case 'suit-changed':
        handleSuitChanged(event.payload);
        break;

      case 'crazy-called':
        handleCrazyCalled(event.payload, getPlayerName, set);
        break;

      case 'invalid-move':
        handleInvalidMove(event.payload, set, get, getPlayerName);
        break;

      case 'blunder-reverted':
        handleBlunderReverted(event.payload, set, getPlayerName);
        break;

      case 'blunder-timeout':
        handleBlunderTimeout(event.payload, set, getPlayerName);
        break;

      case 'player-finished':
        handlePlayerFinished(event.payload, set, get);
        break;

      case 'game-over':
        handleGameOver(event.payload, set);
        break;

      case 'win':
      case 'turn-changed':
        break;
    }
  });
};

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const handleCardPlayed = (
  payload: { playerId: string; cards: Card[] },
  set: SetState,
  getPlayerName: (id: string) => string
) => {
  const label =
    payload.cards.length === 1
      ? `${payload.cards[0].rank}${SUIT_SYMBOLS[payload.cards[0].suit] || ''}`
      : `${payload.cards.length} cards`;
  toast.info(`${getPlayerName(payload.playerId)} played ${label}`);
  set({ lastPlayerId: payload.playerId });
};

const handleSuitChanged = (payload: { suit: string }) => {
  const symbol = SUIT_SYMBOLS[payload.suit] || '';
  const capitalized = payload.suit.charAt(0).toUpperCase() + payload.suit.slice(1);
  toast.info(`Active suit changed to ${symbol} ${capitalized}`);
};

const handleCrazyCalled = (
  payload: { success: boolean; callerId: string; targetId: string; penalty: number },
  getPlayerName: (id: string) => string,
  set: SetState
) => {
  clearActiveBlunderTimers();
  set({
    blunderActive: false,
    blunderReason: null,
    blunderPlayerId: null,
    blunderCards: [],
    blunderTimeLeft: 0,
  });

  if (payload.success) {
    toast.success(
      `${getPlayerName(payload.callerId)} called Crazy on ${getPlayerName(payload.targetId)} (+${payload.penalty} cards)`
    );
  } else {
    toast.error(
      `${getPlayerName(payload.callerId)} made a false Crazy call (+${payload.penalty} cards)`
    );
  }
};

const handleInvalidMove = (
  payload: {
    playerId: string;
    reason: string;
    canBeChallenged: boolean;
    cards?: Card[];
    revertTimeoutMs?: number;
    timeoutMs?: number;
  },
  set: SetState,
  get: GetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();

  const store = get();
  const isMyBlunder = Boolean(store.playerId && payload.playerId === store.playerId);

  if (!payload.canBeChallenged) {
    if (isMyBlunder) {
      toast.error(payload.reason);
    }
    return;
  }

  const revertSec = Math.ceil((payload.revertTimeoutMs || 5000) / 1000);
  const challengeSec = Math.ceil((payload.timeoutMs || 8000) / 1000);

  if (isMyBlunder) {
    set({
      blunderActive: true,
      blunderReason: payload.reason,
      blunderPlayerId: payload.playerId,
      blunderCards: payload.cards || [],
      blunderTimeLeft: revertSec,
      blunderTotalTime: revertSec,
    });
    startBlunderCountdown(revertSec, payload.playerId, true, set, get);
  } else {
    toast.error(`${getPlayerName(payload.playerId)} made a blunder! Call Crazy to challenge.`, {
      duration: 5000,
    });

    set({
      blunderActive: false,
      blunderReason: payload.reason,
      blunderPlayerId: payload.playerId,
      blunderCards: payload.cards || [],
      blunderTimeLeft: challengeSec,
      blunderTotalTime: challengeSec,
    });
    startBlunderCountdown(challengeSec, payload.playerId, false, set, get);
  }
};

const handleBlunderReverted = (
  payload: { playerId: string; message: string },
  set: SetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();
  toast.success(`${getPlayerName(payload.playerId)} reverted their move`, { duration: 3000 });

  set({
    blunderActive: false,
    blunderReason: null,
    blunderPlayerId: null,
    blunderCards: [],
    blunderTimeLeft: 0,
  });
};

const handleBlunderTimeout = (
  payload: { playerId: string; penalty: number; message: string },
  set: SetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();
  toast.warning(
    `${getPlayerName(payload.playerId)} did not revert (+${payload.penalty} penalty cards)`,
    { duration: 4000 }
  );

  set({
    blunderActive: false,
    blunderReason: null,
    blunderPlayerId: null,
    blunderCards: [],
    blunderTimeLeft: 0,
  });
};

const handlePlayerFinished = (
  payload: { playerId: string; playerName: string; rank: number },
  set: SetState,
  get: GetState
) => {
  const { playerId, playerName, rank } = payload;
  const store = get();
  const isMe = Boolean(store.playerId && playerId === store.playerId);

  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
  toast.success(`${isMe ? 'You' : playerName} finished in ${rank}${suffix} place`, {
    duration: 4500,
  });

  const existingPlayer = store.players.find((p) => p.id === playerId);
  const newFinished: RankedPlayer[] = [
    ...store.finishedPlayers.filter((p) => p.id !== playerId),
    {
      id: playerId,
      username: playerName,
      avatar: existingPlayer?.avatar || '🃏',
      rank,
      finishedAt: Date.now(),
    },
  ];
  const newActive = store.activePlayers.filter((p) => p.id !== playerId);

  set({
    finishedPlayers: newFinished,
    activePlayers: newActive,
    isFinished: isMe ? true : store.isFinished,
    myRank: isMe ? rank : store.myRank,
  });
};

const handleGameOver = (payload: { rankings: RankedPlayer[] }, set: SetState) => {
  clearActiveBlunderTimers();
  set({
    gameOver: true,
    gameStarted: false,
    finishedPlayers: payload.rankings,
  });

  toast.success('Match complete — final standings are ready', { duration: 4500 });
};
