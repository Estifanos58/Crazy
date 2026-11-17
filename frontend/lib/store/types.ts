import type { Socket } from 'socket.io-client';
import type { Card, Player, RankedPlayer, GameRoom, PunishmentChain, Suit } from '@/types/game.types';

export interface GameStore {
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  
  // User info and session credentials
  username: string;
  avatar: string;
  playerId: string | null;
  playerToken: string | null;
  
  // Room info
  roomId: string | null;
  room: GameRoom | null;
  isCreator: boolean;
  creatorId: string | null;
  
  // Game state
  gameStarted: boolean;
  yourCards: Card[];
  currentTurn: string | null;
  currentSuit: Suit | null;
  topCard: Card | null;
  punishmentChain: PunishmentChain | null;
  players: Player[];
  lastPlayerId: string | null;
  activePlayers: Player[];
  finishedPlayers: RankedPlayer[];
  gameOver: boolean;
  drawCount: number;
  isFinished: boolean;
  myRank: number | null;
  
  // Blunder state
  blunderActive: boolean;
  blunderReason: string | null;
  blunderPlayerId: string | null;
  blunderCards: Card[];
  blunderTimeLeft: number;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setUserInfo: (username: string, avatar: string) => void;
  createRoom: () => Promise<{ success: boolean; roomId?: string; error?: string }>;
  joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  startGame: (cardsPerPlayer: number, customRules?: string) => Promise<{ success: boolean; error?: string }>;
  playCard: (cards: Card[], chosenSuit?: Suit) => Promise<{ success: boolean; error?: string }>;
  takePunishment: () => Promise<{ success: boolean; error?: string }>;
  callCrazy: () => Promise<{ success: boolean; error?: string }>;
  revertBlunder: () => Promise<{ success: boolean; error?: string }>;
  noRevert: () => Promise<{ success: boolean; error?: string }>;
  setGameState: (state: Partial<GameStore>) => void;
  clearBlunderTimers: () => void;
}

export const initialState: Omit<
  GameStore,
  | 'connect'
  | 'disconnect'
  | 'setUserInfo'
  | 'createRoom'
  | 'joinRoom'
  | 'startGame'
  | 'playCard'
  | 'takePunishment'
  | 'callCrazy'
  | 'revertBlunder'
  | 'noRevert'
  | 'setGameState'
  | 'clearBlunderTimers'
> = {
  socket: null,
  isConnected: false,
  username: '',
  avatar: '',
  playerId: null,
  playerToken: null,
  roomId: null,
  room: null,
  isCreator: false,
  creatorId: null,
  gameStarted: false,
  yourCards: [],
  currentTurn: null,
  currentSuit: null,
  topCard: null,
  punishmentChain: null,
  players: [],
  lastPlayerId: null,
  activePlayers: [],
  finishedPlayers: [],
  gameOver: false,
  drawCount: 0,
  isFinished: false,
  myRank: null,
  blunderActive: false,
  blunderReason: null,
  blunderPlayerId: null,
  blunderCards: [],
  blunderTimeLeft: 0,
};
