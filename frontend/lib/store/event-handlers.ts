import type { Socket } from 'socket.io-client';
import type { Player, GameState } from '@/types/game.types';
import type { GameStore } from './types';
import { saveStateToStorage, clearStateFromStorage } from './storage';

type SetState = (state: Partial<GameStore>) => void;
type GetState = () => GameStore;

/**
 * Setup player event handlers
 */
export const setupPlayerEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('player-joined', (data: { player: Player; players: Player[] }) => {
    console.log('👤 Player joined:', data.player);
    set({ players: data.players });
  });

  socket.on('player-rejoined', (data: { player: Player; players: Player[] }) => {
    console.log('🔄 Player rejoined:', data.player);
    set({ players: data.players });
    saveStateToStorage(get());
  });

  socket.on('player-left', (data: { username: string; avatar: string; players: Player[] }) => {
    console.log('👋 Player left:', data.username);
    const { toast } = require('sonner');
    
    toast.info(`${data.avatar} ${data.username} left the game`, {
      duration: 4000,
    });
    
    set({ players: data.players });
    saveStateToStorage(get());
  });
};

/**
 * Setup game state event handlers
 */
export const setupGameStateEvents = (socket: Socket, set: SetState, get: GetState) => {
  socket.on('game-started', (data: GameState) => {
    console.log('🎮 Game started!');
    const { toast } = require('sonner');
    
    // Show toast for play again scenario
    if (get().gameOver) {
      toast.success('New game started!', { duration: 3000 });
    }
    
    const newState = {
      gameStarted: true,
      yourCards: data.yourCards,
      currentTurn: data.currentTurn,
      currentSuit: data.currentSuit || null,
      topCard: data.topCard || null,
      punishmentChain: data.punishmentChain || null,
      players: data.players,
      activePlayers: data.players.filter(p => p.cardCount > 0),
      finishedPlayers: [],
      gameOver: false,
      drawCount: 0,
      blunderActive: false,
      blunderReason: null,
      blunderPlayerId: null,
      blunderCards: [],
      blunderTimeLeft: 0,
    };
    set(newState);
    saveStateToStorage(newState);
  });

  socket.on('game-update', (data: GameState & { finishedPlayers?: any[] }) => {
    console.log('🔄 Game state updated:', data);
    
    const updatedState: any = {
      yourCards: data.yourCards,
      currentTurn: data.currentTurn,
      currentSuit: data.currentSuit || null,
      topCard: data.topCard || null,
      punishmentChain: data.punishmentChain || null,
      players: data.players,
      activePlayers: data.players,
      drawCount: (data as any).drawCount || 0,
    };
    
    // Update finished players if provided by server
    if (data.finishedPlayers) {
      updatedState.finishedPlayers = data.finishedPlayers;
    }
    
    set(updatedState);
    saveStateToStorage(get());
  });

  socket.on('game-terminated', (data: { message: string }) => {
    console.log('🗑️ Game terminated:', data.message);
    const { toast } = require('sonner');
    
    toast.error('Host has terminated the game', {
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
  socket.on('game-event', (event: any) => {
    console.log('🎯 Game event:', event);
    
    const { toast } = require('sonner');
    const players = get().players;
    const getPlayerName = (id: string) => players.find(p => p.id === id)?.username || 'Unknown';

    switch (event.type) {
      case 'card-played':
        handleCardPlayed(event, set, getPlayerName, toast);
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
        handleSuitChanged(event, toast);
        break;
      
      case 'crazy-called':
        handleCrazyCalled(event, getPlayerName, toast);
        break;
      
      case 'invalid-move':
        handleInvalidMove(event, set, get, getPlayerName, toast);
        break;
      
      case 'blunder-reverted':
        handleBlunderReverted(event, set, getPlayerName, toast);
        break;
      
      case 'win':
        handleWin(event, set, get, toast);
        break;
      
      case 'player-finished':
        handlePlayerFinished(event, set, get, getPlayerName, toast);
        break;
      
      default:
        console.log('Unhandled event:', event);
    }
  });
};

// Individual event handlers
const handleCardPlayed = (event: any, set: SetState, getPlayerName: (id: string) => string, toast: any) => {
  const cardText = event.payload.cards.length === 1 
    ? `${event.payload.cards[0].rank} of ${event.payload.cards[0].suit}`
    : `${event.payload.cards.length} cards`;
  toast.info(`${getPlayerName(event.payload.playerId)} played ${cardText}`);
  set({ lastPlayerId: event.payload.playerId });
};

const handleSuitChanged = (event: any, toast: any) => {
  const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  toast.info(`Suit changed to ${suitSymbols[event.payload.suit as keyof typeof suitSymbols]} ${event.payload.suit}`);
};

const handleCrazyCalled = (event: any, getPlayerName: (id: string) => string, toast: any) => {
  if (event.payload.success) {
    toast.success(`${getPlayerName(event.payload.callerId)} called CRAZY on ${getPlayerName(event.payload.targetId)}! They take ${event.payload.penalty} cards`);
  } else {
    toast.error(`${getPlayerName(event.payload.callerId)} failed to call CRAZY! They take ${event.payload.penalty} cards`);
  }
};

const handleInvalidMove = (event: any, set: SetState, get: GetState, getPlayerName: (id: string) => string, toast: any) => {
  const isMyBlunder = event.payload.playerId === get().socket?.id;
  
  if (isMyBlunder && event.payload.canBeChallenged) {
    // Show modal only to the player who made the blunder
    set({
      blunderActive: true,
      blunderReason: event.payload.reason,
      blunderPlayerId: event.payload.playerId,
      blunderCards: event.payload.cards || [],
      blunderTimeLeft: 5,
    });
    
    let timeLeft = 5;
    const countdownInterval = setInterval(() => {
      timeLeft--;
      set({ blunderTimeLeft: timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        const stillActive = get().blunderActive;
        if (stillActive) {
          setTimeout(() => {
            if (get().blunderActive && get().blunderPlayerId === event.payload.playerId) {
              set({
                blunderActive: false,
                blunderReason: null,
                blunderPlayerId: null,
                blunderCards: [],
                blunderTimeLeft: 0,
              });
            }
          }, 3000);
        }
      }
    }, 1000);
  } else if (event.payload.canBeChallenged) {
    // Show toast to other players - no modal
    toast.error(`🚨 ${getPlayerName(event.payload.playerId)} made a blunder! Click "Call Crazy" to challenge!`, {
      duration: 5000,
      className: 'border-2 border-red-500',
    });
    
    // Store blunder info for "Call Crazy" functionality, but don't show modal
    set({
      blunderActive: false, // Don't show modal to other players
      blunderReason: event.payload.reason,
      blunderPlayerId: event.payload.playerId,
      blunderCards: event.payload.cards || [],
      blunderTimeLeft: 8,
    });
    
    // Clear blunder info after timeout
    setTimeout(() => {
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

const handleBlunderReverted = (event: any, set: SetState, getPlayerName: (id: string) => string, toast: any) => {
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

const handleWin = (event: any, set: SetState, get: GetState, toast: any) => {
  const players = get().players;
  const winnerId = event.playerId || event.payload?.playerId;
  const winner = players.find(p => p.id === winnerId);
  const currentFinished = get().finishedPlayers;
  const rank = currentFinished.length + 1;
  
  if (winner) {
    const winnerName = winner.username;
    const winnerAvatar = winner.avatar;
    const rankText = rank === 1 ? '🏆 Winner!' : `Finished ${rank}${rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}!`;
    
    toast.success(`${winnerAvatar} ${winnerName} - ${rankText}`, {
      duration: 5000,
      className: 'bg-gradient-to-r from-yellow-500/20 to-cyber-primary/20 border-2 border-yellow-500',
    });

    const newFinished = [...currentFinished, { ...winner, rank, finishedAt: Date.now() }];
    const newActive = get().activePlayers.filter(p => p.id !== winner.id);
    
    set({ 
      finishedPlayers: newFinished,
      activePlayers: newActive,
      gameOver: newActive.length <= 1
    });
    
    console.log(`🏆 ${winnerName} finished in position ${rank}! Game Over: ${newActive.length <= 1}`);
  }
};

const handlePlayerFinished = (event: any, set: SetState, get: GetState, getPlayerName: (id: string) => string, toast: any) => {
  const { playerId, playerName, rank } = event.payload;
  const players = get().players;
  const finishedPlayer = players.find(p => p.id === playerId);
  
  if (finishedPlayer) {
    const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    const rankText = rank === 1 ? '🏆 Winner!' : `${rank}${rankSuffix} Place!`;
    
    toast.success(`${finishedPlayer.avatar} ${playerName} finished - ${rankText}`, {
      duration: 5000,
      className: 'bg-gradient-to-r from-yellow-500/20 to-cyber-primary/20 border-2 border-yellow-500',
    });

    const currentFinished = get().finishedPlayers;
    const newFinished = [...currentFinished, { ...finishedPlayer, rank, finishedAt: Date.now() }];
    const newActive = get().activePlayers.filter(p => p.id !== playerId);
    
    set({ 
      finishedPlayers: newFinished,
      activePlayers: newActive,
      gameOver: newActive.length <= 1
    });
    
    console.log(`🏁 ${playerName} finished in position ${rank}! Remaining players: ${newActive.length}`);
  }
};
