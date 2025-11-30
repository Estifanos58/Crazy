import type { Card, Rank, Suit, GameState, RuleConfig, GameEvent, PlayCardAction, RuleValidationResult } from '../types/game.types';

/**
 * RuleService - Extensible rule engine for the Crazy card game
 * 
 * Features:
 * - Configurable rules by room creator
 * - Punishment chain resolution (A♠ + 2s)
 * - Special card effects (reverse, skip, suit change)
 * - Crazy challenge mechanics
 * - Stateless, pure functions
 */
export class RuleService {
  
  /**
   * Default rule configuration
   * Can be customized by room creator
   */
  static getDefaultConfig(): RuleConfig {
    return {
      punishment: {
        aceSpadeCard: { rank: 'A', suit: 'spades' },
        aceSpadePenalty: 5,
        rank2Cards: ['2'],
        rank2Penalty: 2,
      },
      specialCards: {
        reverseCards: [{ rank: '5' }], // Any 5 reverses
        skipCards: [{ rank: '7' }], // Any 7 skips
        suitChangeCards: [{ rank: 'J' }, { rank: '8' }], // J or 8 changes suit
      },
      crazyChallenge: {
        enabled: true,
        penalty: 2,
        responseTimeMs: 3000, // 3 seconds to respond
      },
      illegalTurnPenalty: 2,
      allowDropAllSameSuit: true, // Can drop multiple cards of same suit with 7
      winOnEmpty: true,
    };
  }

  /**
   * Merge custom rules with defaults
   */
  static mergeConfig(customConfig?: Partial<RuleConfig>): RuleConfig {
    const defaults = this.getDefaultConfig();
    if (!customConfig) return defaults;

    return {
      punishment: { ...defaults.punishment, ...customConfig.punishment },
      specialCards: { ...defaults.specialCards, ...customConfig.specialCards },
      crazyChallenge: { ...defaults.crazyChallenge, ...customConfig.crazyChallenge },
      illegalTurnPenalty: customConfig.illegalTurnPenalty ?? defaults.illegalTurnPenalty,
      allowDropAllSameSuit: customConfig.allowDropAllSameSuit ?? defaults.allowDropAllSameSuit,
      winOnEmpty: customConfig.winOnEmpty ?? defaults.winOnEmpty,
    };
  }

  /**
   * Validate if a player can play a card
   */
  static validateMove(gameState: GameState, playerId: string, cards: Card[]): RuleValidationResult {
    const config = this.mergeConfig(gameState.ruleConfig);
    const errors: string[] = [];

    // Check if it's player's turn
    if (gameState.currentTurn !== playerId) {
      return {
        valid: false,
        errors: ['Not your turn'],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    // Check if player has cards
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, errors: ['Player not found'] };
    }

    // Validate cards are in player's hand
    for (const card of cards) {
      if (!player.cards.some(c => c.id === card.id)) {
        errors.push(`Card ${card.id} not in your hand`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Check punishment chain - must play valid response
    if (gameState.punishmentChain.active) {
      const canRespond = this.canRespondToPunishment(cards, gameState, config);
      if (!canRespond) {
        return {
          valid: false,
          errors: ['Must play a valid punishment card or take cards'],
          mustTakeCards: gameState.punishmentChain.amount,
        };
      }
      return { valid: true };
    }

    // Check if multiple cards are allowed (same suit with 7)
    if (cards.length > 1) {
      if (!config.allowDropAllSameSuit) {
        return { valid: false, errors: ['Cannot play multiple cards'] };
      }

      const hasSkipCard = cards.some(c => 
        config.specialCards.skipCards.some(skip => 
          (!skip.suit || skip.suit === c.suit) && skip.rank === c.rank
        )
      );

      if (!hasSkipCard) {
        return { valid: false, errors: ['Can only play multiple cards with skip card (7)'] };
      }

      const firstSuit = cards[0].suit;
      const allSameSuit = cards.every(c => c.suit === firstSuit);
      if (!allSameSuit) {
        return { valid: false, errors: ['All cards must be the same suit'] };
      }

      return { valid: true };
    }

    // Single card validation
    const card = cards[0];

    // Check if no pile yet (first card)
    if (gameState.pile.length === 0) {
      return { valid: true };
    }

    // Check if card matches current suit or rank
    const topCard = gameState.pile[gameState.pile.length - 1];
    const matchesSuit = card.suit === gameState.currentSuit;
    const matchesRank = card.rank === topCard.rank;

    // Suit change cards can always be played
    const isSuitChangeCard = config.specialCards.suitChangeCards.some(sc => 
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
    );

    if (!matchesSuit && !matchesRank && !isSuitChangeCard) {
      return {
        valid: false,
        errors: [`Card must match suit (${gameState.currentSuit}) or rank (${topCard.rank})`],
        canChallengeCrazy: config.crazyChallenge.enabled,
      };
    }

    return { valid: true };
  }

  /**
   * Check if cards can respond to punishment
   */
  static canRespondToPunishment(cards: Card[], gameState: GameState, config: RuleConfig): boolean {
    if (cards.length !== 1) return false;
    
    const card = cards[0];
    const chain = gameState.punishmentChain;

    // Check if it's A♠
    if (card.rank === config.punishment.aceSpadeCard.rank && 
        card.suit === config.punishment.aceSpadeCard.suit) {
      return true;
    }

    // Check if it's a 2
    if (config.punishment.rank2Cards.includes(card.rank)) {
      return true;
    }

    return false;
  }

  /**
   * Apply card effects and update game state
   */
  static applyCardEffects(
    gameState: GameState,
    playerId: string,
    cards: Card[],
    chosenSuit?: Suit
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const events: GameEvent[] = [];
    const newState = this.cloneState(gameState);

    // Remove cards from player's hand
    const player = newState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    for (const card of cards) {
      const cardIndex = player.cards.findIndex(c => c.id === card.id);
      if (cardIndex !== -1) {
        player.cards.splice(cardIndex, 1);
      }
    }

    // Add cards to pile
    newState.pile.push(...cards);

    // Update current suit
    const lastCard = cards[cards.length - 1];
    newState.currentSuit = chosenSuit || lastCard.suit;

    // Process punishment chain first
    const punishmentResult = this.processPunishmentChain(newState, lastCard, config);
    newState.punishmentChain = punishmentResult.chain;
    events.push(...punishmentResult.events);

    // Apply special card effects (if not in punishment chain resolution)
    if (!newState.punishmentChain.active) {
      const specialEffects = this.applySpecialEffects(newState, lastCard, config, chosenSuit);
      events.push(...specialEffects.events);
      Object.assign(newState, specialEffects.stateChanges);
    }

    // Check win condition
    if (config.winOnEmpty && player.cards.length === 0) {
      events.push({
        type: 'win',
        playerId: playerId,
        playerName: player.username,
      });
      newState.winner = playerId;
      newState.gameEnded = true;
    }

    // Advance turn (unless skipped or game ended)
    if (!newState.gameEnded && !events.some(e => e.type === 'skip')) {
      this.advanceTurn(newState);
    }

    return { updatedState: newState, events };
  }

  /**
   * Process punishment chain logic
   */
  private static processPunishmentChain(
    state: GameState,
    card: Card,
    config: RuleConfig
  ): { chain: typeof state.punishmentChain; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const chain = { ...state.punishmentChain };

    // Check if card is A♠
    const isAceSpade = card.rank === config.punishment.aceSpadeCard.rank && 
                       card.suit === config.punishment.aceSpadeCard.suit;

    // Check if card is a 2
    const isRank2 = config.punishment.rank2Cards.includes(card.rank);

    if (isAceSpade) {
      // Start or continue A♠ chain
      chain.active = true;
      chain.amount += config.punishment.aceSpadePenalty;
      chain.cards.push(card);
      
      events.push({
        type: 'punishment_added',
        card: card,
        totalPunishment: chain.amount,
      });
    } else if (isRank2 && chain.active) {
      // Add to existing punishment chain
      chain.amount += config.punishment.rank2Penalty;
      chain.cards.push(card);
      
      events.push({
        type: 'punishment_added',
        card: card,
        totalPunishment: chain.amount,
      });
    } else if (isRank2 && !chain.active) {
      // Start new rank-2 chain
      chain.active = true;
      chain.amount = config.punishment.rank2Penalty;
      chain.cards = [card];
      
      events.push({
        type: 'punishment_added',
        card: card,
        totalPunishment: chain.amount,
      });
    } else if (chain.active) {
      // Chain ends - next player takes punishment
      const nextPlayerId = this.getNextPlayer(state);
      
      events.push({
        type: 'take_punishment',
        playerId: nextPlayerId,
        amount: chain.amount,
        cards: [...chain.cards],
      });

      // Reset chain
      chain.active = false;
      chain.amount = 0;
      chain.cards = [];
    }

    return { chain, events };
  }

  /**
   * Apply special card effects (reverse, skip, suit change)
   */
  private static applySpecialEffects(
    state: GameState,
    card: Card,
    config: RuleConfig,
    chosenSuit?: Suit
  ): { events: GameEvent[]; stateChanges: Partial<GameState> } {
    const events: GameEvent[] = [];
    const stateChanges: Partial<GameState> = {};

    // Check reverse
    const isReverse = config.specialCards.reverseCards.some(rc =>
      rc.rank === card.rank && (!rc.suit || rc.suit === card.suit)
    );

    if (isReverse) {
      stateChanges.turnDirection = state.turnDirection === 'clockwise' ? 'counterclockwise' : 'clockwise';
      events.push({
        type: 'reverse',
        newDirection: stateChanges.turnDirection,
      });
    }

    // Check skip
    const isSkip = config.specialCards.skipCards.some(sc =>
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
    );

    if (isSkip) {
      events.push({
        type: 'skip',
        skippedPlayerId: this.getNextPlayer(state),
      });
      // Advance turn one extra time
      this.advanceTurn(state);
    }

    // Check suit change
    const isSuitChange = config.specialCards.suitChangeCards.some(sc =>
      sc.rank === card.rank && (!sc.suit || sc.suit === card.suit)
    );

    if (isSuitChange && chosenSuit) {
      stateChanges.currentSuit = chosenSuit;
      events.push({
        type: 'suit_change',
        newSuit: chosenSuit,
        card: card,
      });
    }

    return { events, stateChanges };
  }

  /**
   * Handle illegal turn (Crazy call)
   */
  static applyIllegalTurnPenalty(
    gameState: GameState,
    playerId: string,
    calledBy: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = this.cloneState(gameState);
    const events: GameEvent[] = [];

    const player = newState.players.find(p => p.id === playerId);
    if (!player) {
      return { updatedState: newState, events };
    }

    events.push({
      type: 'crazy_called',
      playerId: playerId,
      calledBy: calledBy,
      penalty: config.illegalTurnPenalty,
    });

    // Player draws penalty cards
    const drawnCards = this.drawCards(newState, config.illegalTurnPenalty);
    player.cards.push(...drawnCards);

    events.push({
      type: 'cards_drawn',
      playerId: playerId,
      amount: config.illegalTurnPenalty,
    });

    return { updatedState: newState, events };
  }

  /**
   * Handle crazy challenge (wrong suit played)
   */
  static applyCrazyChallenge(
    gameState: GameState,
    playerId: string,
    challengedBy?: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = this.cloneState(gameState);
    const events: GameEvent[] = [];

    const player = newState.players.find(p => p.id === playerId);
    if (!player) {
      return { updatedState: newState, events };
    }

    if (challengedBy && challengedBy !== playerId) {
      // Someone else called crazy first
      events.push({
        type: 'crazy_challenge_lost',
        playerId: playerId,
        challengedBy: challengedBy,
        penalty: config.crazyChallenge.penalty,
      });

      const drawnCards = this.drawCards(newState, config.crazyChallenge.penalty);
      player.cards.push(...drawnCards);
    } else {
      // Player called crazy on themselves first
      events.push({
        type: 'crazy_challenge_won',
        playerId: playerId,
      });

      // Return last card to hand
      if (newState.pile.length > 0) {
        const returnedCard = newState.pile.pop();
        if (returnedCard) {
          player.cards.push(returnedCard);
        }
      }
    }

    return { updatedState: newState, events };
  }

  /**
   * Handle taking punishment cards
   */
  static takePunishmentCards(gameState: GameState, playerId: string): { updatedState: GameState; events: GameEvent[] } {
    const newState = this.cloneState(gameState);
    const events: GameEvent[] = [];

    const player = newState.players.find(p => p.id === playerId);
    if (!player) {
      return { updatedState: newState, events };
    }

    const amount = newState.punishmentChain.amount;
    const drawnCards = this.drawCards(newState, amount);
    player.cards.push(...drawnCards);

    events.push({
      type: 'punishment_taken',
      playerId: playerId,
      amount: amount,
    });

    // Reset punishment chain
    newState.punishmentChain = {
      active: false,
      amount: 0,
      cards: [],
    };

    // Advance turn
    this.advanceTurn(newState);

    return { updatedState: newState, events };
  }

  /**
   * Get next player in turn order
   */
  private static getNextPlayer(state: GameState): string {
    const currentIndex = state.players.findIndex(p => p.id === state.currentTurn);
    if (currentIndex === -1) return state.players[0].id;

    const direction = state.turnDirection === 'clockwise' ? 1 : -1;
    const nextIndex = (currentIndex + direction + state.players.length) % state.players.length;
    
    return state.players[nextIndex].id;
  }

  /**
   * Advance to next player's turn
   */
  private static advanceTurn(state: GameState): void {
    state.currentTurn = this.getNextPlayer(state);
  }

  /**
   * Draw cards from deck
   */
  private static drawCards(state: GameState, amount: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < amount; i++) {
      if (state.deck.length === 0) {
        // Reshuffle pile if deck is empty (keep top card)
        if (state.pile.length > 1) {
          const topCard = state.pile.pop();
          state.deck = this.shuffleDeck([...state.pile]);
          state.pile = topCard ? [topCard] : [];
        } else {
          break; // No more cards available
        }
      }

      const card = state.deck.pop();
      if (card) {
        drawn.push(card);
      }
    }

    return drawn;
  }

  /**
   * Shuffle deck
   */
  private static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Clone game state (avoid mutations)
   */
  private static cloneState(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map(p => ({
        ...p,
        cards: [...p.cards],
      })),
      deck: [...state.deck],
      pile: [...state.pile],
      punishmentChain: {
        ...state.punishmentChain,
        cards: [...state.punishmentChain.cards],
      },
    };
  }

  /**
   * Check if game has ended
   */
  static checkGameEnd(state: GameState): { ended: boolean; winner?: string } {
    const config = this.mergeConfig(state.ruleConfig);
    
    if (!config.winOnEmpty) {
      return { ended: false };
    }

    const playersWithCards = state.players.filter(p => p.cards.length > 0);
    
    if (playersWithCards.length === 0) {
      return { ended: true, winner: state.winner };
    }

    if (playersWithCards.length === 1 && state.players.length > 1) {
      // Last player loses, everyone else wins
      return { ended: true, winner: state.players.find(p => p.cards.length === 0)?.id };
    }

    return { ended: false };
  }
}
