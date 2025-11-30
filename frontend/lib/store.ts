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
  players: Player[];
  
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
  players: [],

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
        players: data.players,
      });
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
