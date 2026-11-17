import type { Card, GameEvent, GameStateResponse, Player, RankedPlayer, RuleConfig, Suit } from './game.types';

export interface CreateRoomRequest {
  username: string;
  avatar: string;
}

export interface CreateRoomResponse {
  success: boolean;
  roomId?: string;
  playerId?: string;
  playerToken?: string;
  room?: any;
  error?: string;
}

export interface JoinRoomRequest {
  roomId: string;
  username: string;
  avatar: string;
}

export interface JoinRoomResponse {
  success: boolean;
  room?: any;
  playerId?: string;
  playerToken?: string;
  error?: string;
}

export interface RejoinRoomRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
  username?: string;
  avatar?: string;
}

export interface RejoinRoomResponse {
  success: boolean;
  room?: any;
  playerId?: string;
  playerToken?: string;
  error?: string;
}

export interface StartGameRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
  cardsPerPlayer: number;
  customRules?: string;
  ruleConfig?: Partial<RuleConfig>;
}

export interface PlayCardRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
  cards: Card[];
  chosenSuit?: Suit;
}

export interface TakePunishmentRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
}

export interface CallCrazyRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
}

export interface RevertBlunderRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
  cards?: Card[];
}

export interface NoRevertRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
}

export interface LeaveGameRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
  isCreator?: boolean;
  username?: string;
  avatar?: string;
}

export interface PlayAgainRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
}

export interface GetGameStateRequest {
  roomId: string;
  playerId?: string;
  playerToken?: string;
}

export interface StandardResponse {
  success: boolean;
  error?: string;
  isBlunder?: boolean;
}

export interface GetGameStateResponse {
  success: boolean;
  gameState?: GameStateResponse;
  error?: string;
}

export interface ServerToClientEvents {
  'player-joined': (data: { player: Player; players: Player[] }) => void;
  'player-rejoined': (data: { player: Player; players: Player[] }) => void;
  'player-left': (data: { username: string; avatar: string; players: Player[] }) => void;
  'game-started': (data: {
    roomId: string;
    players: Player[];
    currentTurn: string;
    yourCards: Card[];
    topCard?: Card;
    currentSuit?: Suit;
    punishmentChain?: any;
  }) => void;
  'game-update': (data: {
    players: Player[];
    finishedPlayers?: RankedPlayer[];
    currentTurn: string;
    topCard?: Card;
    currentSuit?: Suit;
    yourCards?: Card[];
    punishmentChain?: any;
    drawCount?: number;
  }) => void;
  'game-event': (event: GameEvent) => void;
  'game-terminated': (data: { message: string }) => void;
  'game-over': (data: { rankings: RankedPlayer[] }) => void;
}
