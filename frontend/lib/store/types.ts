import type { Socket } from 'socket.io-client';
import type {
  Card,
  Player,
  PublicRoom,
  PunishmentChain,
  RankedPlayer,
  RuleConfig,
  RulePresetName,
  Suit,
  TurnDirection,
} from '@/types/game.types';

export interface StartGameOptions {
  customRules?: string;
  rulePreset?: RulePresetName;
  ruleConfig?: Partial<RuleConfig>;
}

export interface GameStore {
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  isRestoringSession: boolean;

  // User info and session credentials
  username: string;
  avatar: string;
  playerId: string | null;
  playerToken: string | null;

  // Room info
  roomId: string | null;
  room: PublicRoom | null;
  isCreator: boolean;
  creatorId: string | null;
  terminatedMessage: string | null;

  // Game state
  gameStarted: boolean;
  yourCards: Card[];
  currentTurn: string | null;
  currentSuit: Suit | null;
  turnDirection: TurnDirection;
  topCard: Card | null;
  punishmentChain: PunishmentChain | null;
  players: Player[];
  lastPlayerId: string | null;
  activePlayers: Player[];
  finishedPlayers: RankedPlayer[];
  gameOver: boolean;
  drawCount: number;
  deckCount: number;
  pileCount: number;
  ruleConfig: RuleConfig | null;
  isFinished: boolean;
  myRank: number | null;

  // Blunder state
  blunderActive: boolean;
  blunderReason: string | null;
  blunderPlayerId: string | null;
  blunderCards: Card[];
  blunderTimeLeft: number;
  blunderTotalTime: number;

  // Actions
  connect: () => void;
  disconnect: () => void;
  setUserInfo: (username: string, avatar: string) => void;
  createRoom: () => Promise<{ success: boolean; roomId?: string; error?: string }>;
  joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  rejoinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  fetchGameState: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  startGame: (
    cardsPerPlayer: number,
    options?: StartGameOptions
  ) => Promise<{ success: boolean; error?: string }>;
  playCard: (cards: Card[], chosenSuit?: Suit) => Promise<{ success: boolean; error?: string }>;
  takePunishment: () => Promise<{ success: boolean; error?: string }>;
  callCrazy: () => Promise<{ success: boolean; error?: string }>;
  revertBlunder: () => Promise<{ success: boolean; error?: string }>;
  playAgain: () => Promise<{ success: boolean; error?: string }>;
  leaveGame: (terminateIfHost?: boolean) => Promise<{ success: boolean; error?: string }>;
  setGameState: (state: Partial<GameStore>) => void;
  resetRoomState: () => void;
  clearBlunderTimers: () => void;
}

export const initialRoomState = {
  roomId: null,
  room: null,
  isCreator: false,
  creatorId: null,
  playerId: null,
  playerToken: null,
  terminatedMessage: null,
  gameStarted: false,
  yourCards: [] as Card[],
  currentTurn: null,
  currentSuit: null,
  turnDirection: 'clockwise' as TurnDirection,
  topCard: null,
  punishmentChain: null,
  players: [] as Player[],
  lastPlayerId: null,
  activePlayers: [] as Player[],
  finishedPlayers: [] as RankedPlayer[],
  gameOver: false,
  drawCount: 0,
  deckCount: 0,
  pileCount: 0,
  ruleConfig: null,
  isFinished: false,
  myRank: null,
  blunderActive: false,
  blunderReason: null,
  blunderPlayerId: null,
  blunderCards: [] as Card[],
  blunderTimeLeft: 0,
  blunderTotalTime: 5,
};

export const initialState = {
  socket: null,
  isConnected: false,
  isRestoringSession: false,
  username: '',
  avatar: '',
  ...initialRoomState,
};
