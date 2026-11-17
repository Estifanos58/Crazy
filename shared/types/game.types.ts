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
  cardCount: number;
  isCreator: boolean;
  rank?: number; // Position when finished (1st, 2nd, etc.)
  finishedAt?: number;
  connected?: boolean;
}

export interface RankedPlayer {
  id: string;
  username: string;
  avatar: string;
  rank: number;
  finishedAt?: number;
}

export interface CardSelector {
  rank: Rank;
  suit?: Suit;
}

export interface PunishmentConfig {
  aceSpadeCard: CardSelector;
  aceSpadePenalty: number;
  rank2Cards: Rank[];
  rank2Penalty: number;
}

export interface SpecialCardsConfig {
  reverseCards: CardSelector[];
  skipCards: CardSelector[];
  suitChangeCards: CardSelector[];
  dropCards: CardSelector;
}

export interface CrazyChallengeConfig {
  enabled: boolean;
  penalty: number;
  responseTimeMs: number;
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

export interface GameRules {
  cardsPerPlayer: number;
  customRules?: string;
}

export interface BlunderState {
  active: boolean;
  playerId: string;
  cards: Card[];
  penalty: number;
  timestamp: number;
  revertTimeoutMs?: number;
  challengeTimeoutMs?: number;
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

export interface GameStateResponse {
  roomId: string;
  players: Player[];
  finishedPlayers: RankedPlayer[];
  currentTurn: string;
  topCard?: Card;
  currentSuit?: Suit;
  yourCards: Card[];
  punishmentChain?: PunishmentChain;
  turnDirection: TurnDirection;
  gameOver: boolean;
  pileCount: number;
  deckCount: number;
  drawCount: number;
  isFinished?: boolean;
  rank?: number;
  blunderState?: {
    active: boolean;
    playerId: string;
    cards: Card[];
    timeLeft: number;
    canRevert: boolean;
  };
}
