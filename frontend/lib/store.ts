import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { Card, Player, GameRoom, GameState } from '@/types/game.types';

interface GameStore {
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  
  // User info
  username: string;
  avatar: string;
  
  // Room info
  roomId: string | null;
  room: GameRoom | null;
  isCreator: boolean;
  
  // Game state
  gameStarted: boolean;
  yourCards: Card[];
  currentTurn: string | null;
  currentSuit: string | null;
  topCard: Card | null;
  punishmentChain: { active: boolean; amount: number; cards: Card[] } | null;
  players: Player[];
  lastPlayerId: string | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setUserInfo: (username: string, avatar: string) => void;
  createRoom: () => Promise<{ success: boolean; roomId?: string; error?: string }>;
  joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  startGame: (cardsPerPlayer: number, customRules?: string) => Promise<{ success: boolean; error?: string }>;
  playCard: (cards: Card[], chosenSuit?: string) => Promise<{ success: boolean; error?: string }>;
  takePunishment: () => Promise<{ success: boolean; error?: string }>;
  callCrazy: (targetPlayerId: string) => Promise<{ success: boolean; error?: string }>;
  setGameState: (state: Partial<GameStore>) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  isConnected: false,
  username: '',
  avatar: '',
  roomId: null,
  room: null,
  isCreator: false,
  gameStarted: false,
  yourCards: [],
  currentTurn: null,
  currentSuit: null,
  topCard: null,
  punishmentChain: null,
  players: [],
  lastPlayerId: null,

  connect: () => {
    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      set({ socket, isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      set({ isConnected: false });
    });

    socket.on('player-joined', (data: { player: Player; players: Player[] }) => {
      console.log('👤 Player joined:', data.player);
      set({ players: data.players });
    });

    socket.on('game-started', (data: GameState) => {
      console.log('🎮 Game started!');
      set({
        gameStarted: true,
        yourCards: data.yourCards,
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players,
      });
    });

    socket.on('game-update', (data: GameState) => {
      console.log('🔄 Game state updated:', data);
      set({
        yourCards: data.yourCards,
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players,
      });
    });

    socket.on('game-event', (event: any) => {
      console.log('🎯 Game event:', event);
      
      const { toast } = require('sonner');
      const players = get().players;
      const getPlayerName = (id: string) => players.find(p => p.id === id)?.username || 'Unknown';

      switch (event.type) {
        case 'card-played':
          const cardText = event.payload.cards.length === 1 
            ? `${event.payload.cards[0].rank} of ${event.payload.cards[0].suit}`
            : `${event.payload.cards.length} cards`;
          toast.info(`${getPlayerName(event.payload.playerId)} played ${cardText}`);
          set({ lastPlayerId: event.payload.playerId });
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
          const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
          toast.info(`Suit changed to ${suitSymbols[event.payload.suit as keyof typeof suitSymbols]} ${event.payload.suit}`);
          break;
        
        case 'crazy-called':
          if (event.payload.success) {
            toast.success(`${getPlayerName(event.payload.callerId)} called CRAZY on ${getPlayerName(event.payload.targetId)}! They take ${event.payload.penalty} cards`);
          } else {
            toast.error(`${getPlayerName(event.payload.callerId)} failed to call CRAZY! They take ${event.payload.penalty} cards`);
          }
          break;
        
        case 'invalid-move':
          toast.error(`Invalid move: ${event.payload.reason}`);
          break;
        
        default:
          console.log('Unhandled event:', event);
      }
    });

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

  createRoom: (): Promise<{ success: boolean; roomId?: string; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, username, avatar } = get();
      
      if (!socket || !username || !avatar) {
        resolve({ success: false, error: 'Missing required information' });
        return;
      }

      socket.emit('create-room', { username, avatar }, (response: any) => {
        if (response.success) {
          set({
            roomId: response.room.roomId,
            room: response.room,
            isCreator: true,
            players: response.room.players,
          });
          resolve({ success: true, roomId: response.room.roomId });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  joinRoom: (roomId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, username, avatar } = get();
      
      if (!socket || !username || !avatar) {
        resolve({ success: false, error: 'Missing required information' });
        return;
      }

      socket.emit('join-room', { roomId, username, avatar }, (response: any) => {
        if (response.success) {
          set({
            roomId: response.room.roomId,
            room: response.room,
            isCreator: false,
            players: response.room.players,
          });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  startGame: (cardsPerPlayer: number, customRules?: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('start-game', { roomId, cardsPerPlayer, customRules }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  playCard: (cards: Card[], chosenSuit?: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('play-card', { roomId, cards, chosenSuit }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  takePunishment: (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('take-punishment', { roomId }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  callCrazy: (targetPlayerId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('call-crazy', { roomId, targetPlayerId }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  setGameState: (state: Partial<GameStore>) => {
    set(state);
  },
}));
