export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

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
  rank?: number;
  finishedAt?: number;
}

export interface RankedPlayer {
  id: string;
  username: string;
  avatar: string;
  rank: number;
}

export interface GameRules {
  cardsPerPlayer: number;
  customRules?: string;
}

export interface GameRoom {
  roomId: string;
  creatorId: string;
  players: Player[];
  gameStarted: boolean;
  rules?: GameRules;
  currentTurn?: string;
}

export interface GameState {
  yourCards: Card[];
  currentTurn: string;
  currentSuit?: Suit;
  topCard?: Card | null;
  punishmentChain?: {
    active: boolean;
    amount: number;
    cards: Card[];
  };
  rules?: GameRules;
  players: Player[];
}

export interface GameEvent {
  type: string;
  payload: any;
}
