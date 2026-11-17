export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type TurnDirection = 'clockwise' | 'counterclockwise';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string; // Unique, persistent player ID
  username: string;
  avatar: string;
  cardCount: number; // Public card count visible to other players
  isCreator: boolean;
  rank?: number; // Position when finished (1st, 2nd, 3rd, etc.)
  finishedAt?: number; // Timestamp when finished
  connected?: boolean;
}

export interface ServerPlayer {
  id: string;
  token: string; // Secret session token for auth
  username: string;
  avatar: string;
  cards: Card[]; // Private server-authoritative cards
  isCreator: boolean;
  rank?: number;
  finishedAt?: number;
  socketId?: string;
  connected: boolean;
}

export interface RankedPlayer {
  id: string;
  username: string;
  avatar: string;
  rank: number;
  finishedAt?: number;
}

export interface GameRules {
  cardsPerPlayer: number;
  customRules?: string;
}

// ============ RULE SYSTEM TYPES ============

export interface CardSelector {
  rank: Rank;
  suit?: Suit;
}

export interface PunishmentConfig {
  aceSpadeCard: CardSelector; // Default: A♠
  aceSpadePenalty: number; // Default: 5 cards
  rank2Cards: Rank[]; // Default: ['2']
  rank2Penalty: number; // Default: 2 cards
}

export interface SpecialCardsConfig {
  reverseCards: CardSelector[]; // Default: any 5
  skipCards: CardSelector[]; // Default: any 7
  suitChangeCards: CardSelector[]; // Default: J or 8
  dropCards: CardSelector; // Default: 7
}

export interface CrazyChallengeConfig {
  enabled: boolean;
  penalty: number; // Cards to draw if you lose challenge
  responseTimeMs: number; // Time window to respond
}

export interface RuleConfig {
  punishment: PunishmentConfig;
  specialCards: SpecialCardsConfig;
  crazyChallenge: CrazyChallengeConfig;
  illegalTurnPenalty: number;
  allowDropAllSameSuit: boolean;
  winOnEmpty: boolean;
}

export interface PunishmentChain {
  active: boolean;
  amount: number;
  cards: Card[];
}

export interface BlunderState {
  active: boolean;
  playerId: string; // Player who made the blunder
  cards: Card[]; // The cards that were played as a blunder
  penalty: number;
  timestamp: number;
  revertTimeoutMs?: number; // default: 5000 ms
  challengeTimeoutMs?: number; // default: 8000 ms
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

export type GameEvent =
  | { type: 'card-played'; payload: { playerId: string; cards: Card[] } }
  | { type: 'cards_drawn'; playerId: string; amount: number }
  | { type: 'punishment-taken'; payload: { playerId: string; amount: number } }
  | { type: 'punishment-chain-started'; payload: { amount: number } }
  | { type: 'punishment-chain-increased'; payload: { amount: number } }
  | { type: 'turn-reversed'; payload: { direction: TurnDirection } }
  | { type: 'player-skipped'; payload: { playerId: string } }
  | { type: 'suit-changed'; payload: { suit: Suit } }
  | { type: 'crazy-called'; payload: { success: boolean; callerId: string; targetId: string; penalty: number } }
  | { type: 'invalid-move'; payload: { playerId: string; reason: string; canBeChallenged: boolean; cards?: Card[]; timeoutMs?: number } }
  | { type: 'blunder-reverted'; payload: { playerId: string; message: string } }
  | { type: 'blunder-timeout'; payload: { playerId: string; penalty: number; message: string } }
  | { type: 'win'; playerId: string; playerName: string }
  | { type: 'player-finished'; payload: { playerId: string; playerName: string; rank: number } }
  | { type: 'game-over'; payload: { rankings: RankedPlayer[] } }
  | { type: 'turn-changed'; payload: { playerId: string } };

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
  ruleConfig?: Partial<RuleConfig>;
}
