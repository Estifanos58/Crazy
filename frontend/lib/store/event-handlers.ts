import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type { Player, GameState, GameEvent, RankedPlayer } from '@/types/game.types';
import type { GameStore } from './types';
import { saveStateToStorage, clearStateFromStorage } from './storage';

type SetState = (state: Partial<GameStore>) => void;
type GetState = () => GameStore;

// Timers tracking for cleanup
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

/**
 * Setup player event handlers
 */
export const setupPlayerEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('player-joined', (data: { player?: Player; players: Player[] }) => {
    if (data?.player) {
      console.log('👤 Player joined:', data.player);
    }
    set({ players: data.players || [] });
  });

  socket.on('player-rejoined', (data: { player?: Player; players: Player[] }) => {
    if (data?.player) {
      console.log('🔄 Player rejoined:', data.player);
    }
    set({ players: data.players || [] });
    saveStateToStorage(get());
  });

  socket.on('player-left', (data: { username: string; avatar: string; players: Player[] }) => {
    console.log('👋 Player left:', data.username);
    toast.info(`${data.avatar} ${data.username} left the game`, {
      duration: 4000,
    });
    
    set({ players: data.players || [] });
    saveStateToStorage(get());
  });
};

/**
 * Setup game state event handlers
 */
export const setupGameStateEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('game-started', (data: GameState) => {
    console.log('🎮 Game started!');
    clearActiveBlunderTimers();
    
    if (get().gameOver) {
      toast.success('New game started!', { duration: 3000 });
    }
    
    const newState: Partial<GameStore> = {
      gameStarted: true,
      gameOver: false,
      yourCards: data.yourCards || [],
      currentTurn: data.currentTurn,
      currentSuit: data.currentSuit || null,
      topCard: data.topCard || null,
      punishmentChain: data.punishmentChain || null,
      players: data.players || [],
      activePlayers: data.players || [],
      finishedPlayers: [],
      drawCount: 0,
      isFinished: false,
      myRank: null,
      blunderActive: false,
      blunderReason: null,
      blunderPlayerId: null,
      blunderCards: [],
      blunderTimeLeft: 0,
    };
    set(newState);
    saveStateToStorage(get());
  });

  socket.on('game-update', (data: GameState & { finishedPlayers?: RankedPlayer[]; drawCount?: number }) => {
    console.log('🔄 Game state updated:', data);
    
    const store = get();
    const myId = store.playerId || store.socket?.id;
    const isFinished = Boolean(
      data.finishedPlayers?.some(fp => fp.id === myId) || store.isFinished
    );
    const myRank = data.finishedPlayers?.find(fp => fp.id === myId)?.rank || store.myRank;

    const updatedState: Partial<GameStore> = {
      yourCards: data.yourCards || store.yourCards,
      currentTurn: data.currentTurn,
      currentSuit: data.currentSuit || null,
      topCard: data.topCard || null,
      punishmentChain: data.punishmentChain || null,
      players: data.players || store.players,
      activePlayers: data.players || [],
      drawCount: data.drawCount ?? store.drawCount ?? 0,
      isFinished,
      myRank,
    };
    
    if (data.finishedPlayers) {
      updatedState.finishedPlayers = data.finishedPlayers;
    }
    
    set(updatedState);
    saveStateToStorage(get());
  });

  socket.on('game-terminated', (data: { message?: string }) => {
    console.log('🗑️ Game terminated:', data?.message);
    clearActiveBlunderTimers();

    toast.error(data?.message || 'Host has terminated the game', {
      duration: 5000,
      className: 'border-2 border-red-500',
    });
    
    clearStateFromStorage();
    
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }, 2000);
  });
};

/**
 * Setup game event handlers (card plays, wins, etc.)
 */
export const setupGameEventHandlers = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('game-event', (event: GameEvent) => {
    console.log('🎯 Game event:', event);
    
    const players = get().players;
    const getPlayerName = (id: string) => players.find(p => p.id === id)?.username || 'Unknown';

    switch (event.type) {
      case 'card-played':
        handleCardPlayed(event, set, getPlayerName);
        break;
      
      case 'cards_drawn':
        toast.info(`${getPlayerName(event.playerId)} drew ${event.amount} card(s)`);
        break;

      case 'punishment-taken':
        toast.warning(`${getPlayerName(event.payload.playerId)} took ${event.payload.amount} punishment card(s)`);
        break;
      
      case 'punishment-chain-started':
        toast.error(`⚠️ Punishment chain started! ${event.payload.amount} cards`);
        break;
      
      case 'punishment-chain-increased':
        toast.error(`⚠️ Punishment chain increased to ${event.payload.amount} cards!`);
        break;
      
      case 'turn-reversed':
        toast.info('🔄 Turn direction reversed!');
        break;
      
      case 'player-skipped':
        toast.info(`⏭️ ${getPlayerName(event.payload.playerId)} was skipped`);
        break;
      
      case 'suit-changed':
        handleSuitChanged(event);
        break;
      
      case 'crazy-called':
        handleCrazyCalled(event, getPlayerName, set);
        break;
      
      case 'invalid-move':
        handleInvalidMove(event, set, get, getPlayerName);
        break;
      
      case 'blunder-reverted':
        handleBlunderReverted(event, set, getPlayerName);
        break;
      
      case 'blunder-timeout':
        handleBlunderTimeout(event, set, getPlayerName);
        break;
      
      case 'win':
        handleWin(event, set, get);
        break;
      
      case 'player-finished':
        handlePlayerFinished(event, set, get);
        break;

      case 'game-over':
        handleGameOver(event, set, get);
        break;
      
      default:
        console.log('Unhandled event:', event);
    }
  });
};

const handleCardPlayed = (event: { payload: { playerId: string; cards: any[] } }, set: SetState, getPlayerName: (id: string) => string) => {
  const cardText = event.payload.cards.length === 1 
    ? `${event.payload.cards[0].rank} of ${event.payload.cards[0].suit}`
    : `${event.payload.cards.length} cards`;
  toast.info(`${getPlayerName(event.payload.playerId)} played ${cardText}`);
  set({ lastPlayerId: event.payload.playerId });
};

const handleSuitChanged = (event: { payload: { suit: string } }) => {
  const suitSymbols: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  toast.info(`Suit changed to ${suitSymbols[event.payload.suit] || ''} ${event.payload.suit}`);
};

const handleCrazyCalled = (
  event: { payload: { success: boolean; callerId: string; targetId: string; penalty: number } },
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

  if (event.payload.success) {
    toast.success(`${getPlayerName(event.payload.callerId)} called CRAZY on ${getPlayerName(event.payload.targetId)}! They take ${event.payload.penalty} cards`);
  } else {
    toast.error(`${getPlayerName(event.payload.callerId)} failed to call CRAZY! They take ${event.payload.penalty} cards`);
  }
};

const handleInvalidMove = (
  event: { payload: { playerId: string; reason: string; canBeChallenged: boolean; cards?: any[]; timeoutMs?: number } },
  set: SetState,
  get: GetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();

  const store = get();
  const myId = store.playerId || store.socket?.id;
  const isMyBlunder = event.payload.playerId === myId;
  
  if (isMyBlunder && event.payload.canBeChallenged) {
    set({
      blunderActive: true,
      blunderReason: event.payload.reason,
      blunderPlayerId: event.payload.playerId,
      blunderCards: event.payload.cards || [],
      blunderTimeLeft: 5,
    });
    
    let timeLeft = 5;
    blunderCountdownInterval = setInterval(() => {
      timeLeft--;
      set({ blunderTimeLeft: timeLeft });
      
      if (timeLeft <= 0) {
        if (blunderCountdownInterval) {
          clearInterval(blunderCountdownInterval);
          blunderCountdownInterval = null;
        }
      }
    }, 1000);
  } else if (event.payload.canBeChallenged) {
    toast.error(`🚨 ${getPlayerName(event.payload.playerId)} made a blunder! Click "Call Crazy" to challenge!`, {
      duration: 5000,
      className: 'border-2 border-red-500',
    });
    
    set({
      blunderActive: false,
      blunderReason: event.payload.reason,
      blunderPlayerId: event.payload.playerId,
      blunderCards: event.payload.cards || [],
      blunderTimeLeft: 8,
    });
    
    blunderClearTimeout = setTimeout(() => {
      if (get().blunderPlayerId === event.payload.playerId) {
        set({
          blunderActive: false,
          blunderReason: null,
          blunderPlayerId: null,
          blunderCards: [],
          blunderTimeLeft: 0,
        });
      }
    }, 8000);
  } else {
    toast.error(`Invalid move: ${event.payload.reason}`);
  }
};

const handleBlunderReverted = (
  event: { payload: { playerId: string; message: string } },
  set: SetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();
  toast.success(`${getPlayerName(event.payload.playerId)} reverted their move`, {
    duration: 3000,
  });
  
  set({
    blunderActive: false,
    blunderReason: null,
    blunderPlayerId: null,
    blunderCards: [],
    blunderTimeLeft: 0,
  });
};

const handleBlunderTimeout = (
  event: { payload: { playerId: string; penalty: number; message: string } },
  set: SetState,
  getPlayerName: (id: string) => string
) => {
  clearActiveBlunderTimers();
  toast.warning(`${getPlayerName(event.payload.playerId)} didn't revert - penalty applied (${event.payload.penalty} cards)`, {
    duration: 4000,
    className: 'border-2 border-yellow-500',
  });
  
  set({
    blunderActive: false,
    blunderReason: null,
    blunderPlayerId: null,
    blunderCards: [],
    blunderTimeLeft: 0,
  });
};

const handleWin = (event: { playerId?: string; playerName?: string }, _set: SetState, _get: GetState) => {
  toast.success(`🏆 ${event.playerName || 'Player'} has won!`, {
    duration: 5000,
  });
};

const handlePlayerFinished = (
  event: { payload: { playerId: string; playerName: string; rank: number } },
  set: SetState,
  get: GetState
) => {
  const { playerId, playerName, rank } = event.payload;
  const store = get();
  const myId = store.playerId || store.socket?.id;
  const isMe = playerId === myId;

  const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
  toast.success(`🏁 ${playerName} finished in ${rank}${rankSuffix} Place!`, {
    duration: 5000,
  });

  const currentFinished = store.finishedPlayers || [];
  const existingPlayer = store.players.find(p => p.id === playerId);
  const newFinished: RankedPlayer[] = [
    ...currentFinished.filter(p => p.id !== playerId),
    {
      id: playerId,
      username: playerName,
      avatar: existingPlayer?.avatar || '👤',
      rank,
      finishedAt: Date.now(),
    },
  ];

  const newActive = store.activePlayers.filter(p => p.id !== playerId);

  set({
    finishedPlayers: newFinished,
    activePlayers: newActive,
    isFinished: isMe ? true : store.isFinished,
    myRank: isMe ? rank : store.myRank,
    gameOver: newActive.length <= 1,
  });

  saveStateToStorage(get());
};

const handleGameOver = (
  event: { payload: { rankings: RankedPlayer[] } },
  set: SetState,
  get: GetState
) => {
  clearActiveBlunderTimers();
  set({
    gameOver: true,
    gameStarted: false,
    finishedPlayers: event.payload.rankings,
  });

  toast.success('🎉 Game Over! Final rankings ready.', { duration: 5000 });
  saveStateToStorage(get());
};
