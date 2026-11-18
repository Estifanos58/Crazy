import type {
  Card,
  GameEvent,
  GameStartedPayload,
  GameStateResponse,
  GameUpdatePayload,
  Player,
  PublicRoom,
  RankedPlayer,
  RuleConfig,
  RulePresetName,
  Suit,
} from './game.types';

export interface CreateRoomRequest {
  username: string;
  avatar: string;
}

export interface CreateRoomResponse {
  success: boolean;
  roomId?: string;
  playerId?: string;
  playerToken?: string;
  room?: PublicRoom;
  error?: string;
}

export interface JoinRoomRequest {
  roomId: string;
  username: string;
  avatar: string;
}

export interface JoinRoomResponse {
  success: boolean;
  room?: PublicRoom;
  playerId?: string;
  playerToken?: string;
  error?: string;
}

export interface GetRoomResponse {
  success: boolean;
  room?: PublicRoom;
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
  room?: PublicRoom;
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
  rulePreset?: RulePresetName;
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
  'player-joined': (data: { player?: Player; players: Player[] }) => void;
  'player-rejoined': (data: { player?: Player; players: Player[] }) => void;
  'player-left': (data: { username: string; avatar: string; players: Player[]; creatorId?: string }) => void;
  'player-disconnected': (data: { playerId: string; players: Player[] }) => void;
  'game-started': (data: GameStartedPayload) => void;
  'game-update': (data: GameUpdatePayload) => void;
  'game-event': (event: GameEvent) => void;
  'game-terminated': (data: { message: string }) => void;
  'game-over': (data: { rankings: RankedPlayer[] }) => void;
}
