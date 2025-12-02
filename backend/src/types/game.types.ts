export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type TurnDirection = 'clockwise' | 'counterclockwise';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  username: string;
  avatar: string;
  cards: Card[];
  isCreator: boolean;
  rank?: number; // Position when finished (1st, 2nd, 3rd, etc.)
  finishedAt?: number; // Timestamp when finished
}

export interface GameRules {
  cardsPerPlayer: number;
  customRules?: string;
}

// ============ RULE SYSTEM TYPES ============

/**
 * Card selector for rule configuration
 * Can specify specific cards or just ranks
 */
export interface CardSelector {
  rank: Rank;
  suit?: Suit; // If omitted, applies to all suits
}

/**
 * Punishment rule configuration
 */
export interface PunishmentConfig {
  aceSpadeCard: CardSelector; // Default: A♠
  aceSpadePenalty: number; // Default: 5 cards
  rank2Cards: Rank[]; // Default: ['2']
  rank2Penalty: number; // Default: 2 cards
}

/**
 * Special card effects configuration
 */
export interface SpecialCardsConfig {
  reverseCards: CardSelector[]; // Default: any 5
  skipCards: CardSelector[]; // Default: any 7
  suitChangeCards: CardSelector[]; // Default: J or 8
  dropCards: CardSelector; // Default: 7
}

/**
 * Crazy challenge configuration
 */
export interface CrazyChallengeConfig {
  enabled: boolean;
  penalty: number; // Cards to draw if you lose challenge
  responseTimeMs: number; // Time window to respond
}

/**
 * Complete rule configuration
 * All fields are user-adjustable
 */
export interface RuleConfig {
  punishment: PunishmentConfig;
  specialCards: SpecialCardsConfig;
  crazyChallenge: CrazyChallengeConfig;
  illegalTurnPenalty: number; // Cards for playing out of turn
  allowDropAllSameSuit: boolean; // Can drop multiple cards with 7
  winOnEmpty: boolean; // First to empty hand wins
}

/**
 * Punishment chain state
 */
export interface PunishmentChain {
  active: boolean;
  amount: number; // Total cards to draw
  cards: Card[]; // Cards in the chain (A♠, 2s, etc.)
}

/**
 * Complete game state
 */
export interface GameState {
  roomId: string;
  players: Player[];
  deck: Card[];
  pile: Card[]; // Discard pile
  currentTurn: string; // Player ID
  currentSuit: Suit; // Active suit (can differ from top card if changed)
  turnDirection: TurnDirection;
  punishmentChain: PunishmentChain;
  ruleConfig?: RuleConfig;
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: string;
}

/**
 * Game events emitted by rule engine
 */
export type GameEvent =
  | { type: 'punishment_added'; card: Card; totalPunishment: number }
  | { type: 'take_punishment'; playerId: string; amount: number; cards: Card[] }
  | { type: 'punishment_taken'; playerId: string; amount: number }
  | { type: 'reverse'; newDirection: TurnDirection }
  | { type: 'skip'; skippedPlayerId: string }
  | { type: 'suit_change'; newSuit: Suit; card: Card }
  | { type: 'crazy_called'; playerId: string; calledBy: string; penalty: number }
  | { type: 'crazy_challenge_lost'; playerId: string; challengedBy: string; penalty: number }
  | { type: 'crazy_challenge_won'; playerId: string }
  | { type: 'cards_drawn'; playerId: string; amount: number }
  | { type: 'win'; playerId: string; playerName: string }
  | { type: 'turn_changed'; playerId: string }
  | { type: 'card-played'; payload: { playerId: string; cards: Card[] } }
  | { type: 'invalid-move'; payload: { playerId: string; reason: string; canBeChallenged: boolean; cards?: Card[] } }
  | { type: 'blunder-reverted'; payload: { playerId: string; message: string } }
  | { type: 'punishment-taken'; payload: { playerId: string; amount: number } }
  | { type: 'punishment-chain-started'; payload: { amount: number } }
  | { type: 'punishment-chain-increased'; payload: { amount: number } }
  | { type: 'turn-reversed'; payload: {} }
  | { type: 'player-skipped'; payload: { playerId: string } }
  | { type: 'suit-changed'; payload: { suit: Suit } }
  | { type: 'crazy-called'; payload: { success: boolean; callerId: string; targetId: string; penalty: number } }
  | { type: 'player-finished'; payload: { playerId: string; playerName: string; rank: number } };

/**
 * Rule validation result
 */
export interface RuleValidationResult {
  valid: boolean;
  errors?: string[];
  canChallengeCrazy?: boolean;
  mustTakeCards?: number;
}

/**
 * Play card action
 */
export interface PlayCardAction {
  playerId: string;
  cards: Card[];
  chosenSuit?: Suit; // For suit change cards
}

// ============ EXISTING TYPES ============

export interface GameRoom {
  roomId: string;
  creatorId: string;
  players: Player[]; // Active players still in the game
  finishedPlayers?: Player[]; // Players who have finished (ran out of cards)
  gameStarted: boolean;
  rules?: GameRules;
  ruleConfig?: RuleConfig; // New: configurable rules
  currentTurn?: string;
  currentSuit?: Suit;
  turnDirection?: TurnDirection;
  deck: Card[];
  pile?: Card[];
  punishmentChain?: PunishmentChain;
  drawCount?: number; // Track how many times current player has drawn (0, 1, or 2)
  createdAt: number;
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
  ruleConfig?: Partial<RuleConfig>; // New: custom rule configuration
}
