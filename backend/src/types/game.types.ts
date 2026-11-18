export * from '../../../shared';

import type {
  BlunderState,
  Card,
  GameRules,
  PunishmentChain,
  RuleConfig,
  RulePresetName,
  Suit,
  TurnDirection,
} from '../../../shared';

export interface ServerPlayer {
  id: string;
  token: string; // Secret session token for auth (never sent to other players)
  username: string;
  avatar: string;
  cards: Card[]; // Private server-authoritative cards
  isCreator: boolean;
  rank?: number;
  finishedAt?: number;
  socketId?: string;
  connected: boolean;
}

export interface GameRoom {
  roomId: string;
  creatorId: string;
  players: ServerPlayer[]; // Active players still in the game
  finishedPlayers?: ServerPlayer[]; // Players who have finished (ran out of cards)
  gameStarted: boolean;
  gameOver?: boolean;
  rules?: GameRules;
  ruleConfig?: RuleConfig;
  currentTurn?: string;
  currentSuit?: Suit;
  turnDirection?: TurnDirection;
  deck: Card[];
  pile?: Card[];
  punishmentChain?: PunishmentChain;
  drawCount?: number; // Track how many times current player has drawn (0 or 1)
  blunderState?: BlunderState;
  lastSuitChangedBy?: string;
  createdAt: number;
}

export interface GameState {
  roomId: string;
  players: ServerPlayer[];
  deck: Card[];
  pile: Card[];
  currentTurn: string;
  currentSuit: Suit;
  turnDirection: TurnDirection;
  punishmentChain: PunishmentChain;
  ruleConfig?: RuleConfig;
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: string;
  lastSuitChangedBy?: string;
}

export interface RuleValidationResult {
  valid: boolean;
  errors?: string[];
  canChallengeCrazy?: boolean;
  mustTakeCards?: number;
}

export interface PlayCardAction {
  playerId: string;
  cards: Card[];
  chosenSuit?: Suit;
}

export interface JoinRoomData {
  roomId: string;
  username: string;
  avatar: string;
}

export interface StartGameData {
  roomId: string;
  cardsPerPlayer: number;
  customRules?: string;
  rulePreset?: RulePresetName;
  ruleConfig?: Partial<RuleConfig>;
}
