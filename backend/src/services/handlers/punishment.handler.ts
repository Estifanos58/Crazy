import type { GameState, RuleConfig, Card, GameEvent, Suit } from '../../types/game.types';

/**
 * PunishmentChainManager - Handles punishment chain logic
 */
export class PunishmentChainManager {
  /**
   * Process punishment chain for a played card
   */
  static processPunishmentChain(
    state: GameState,
    card: Card,
    config: RuleConfig
  ): { chain: typeof state.punishmentChain; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const chain = { ...state.punishmentChain };

    const isAceSpade = card.rank === config.punishment.aceSpadeCard.rank && 
                       card.suit === config.punishment.aceSpadeCard.suit;
    const isRank2 = config.punishment.rank2Cards.includes(card.rank);

    if (isAceSpade) {
      return this.handleAceSpade(chain, config, events);
    } else if (isRank2 && chain.active) {
      return this.handleRank2OnActiveChain(chain, config, events);
    } else if (isRank2 && !chain.active) {
      return this.handleRank2StartChain(chain, config, events);
    } else if (chain.active) {
      return this.handleChainEnd(chain, events);
    }

    return { chain, events };
  }

  /**
   * Handle A♠ played
   */
  private static handleAceSpade(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[]
  ) {
    if (chain.active) {
      // A♠ ends punishment and starts new one
      chain.amount = config.punishment.aceSpadePenalty;
      events.push({
        type: 'punishment-chain-started',
        payload: { amount: chain.amount },
      });
    } else {
      // Start new punishment chain
      chain.active = true;
      chain.amount = config.punishment.aceSpadePenalty;
      const aceCard = config.punishment.aceSpadeCard;
      chain.cards = [{
        rank: aceCard.rank,
        suit: aceCard.suit as Suit,
        id: `${aceCard.rank}-${aceCard.suit}`
      }];
      events.push({
        type: 'punishment-chain-started',
        payload: { amount: chain.amount },
      });
    }

    return { chain, events };
  }

  /**
   * Handle 2 played on active chain
   */
  private static handleRank2OnActiveChain(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[]
  ) {
    chain.amount += config.punishment.rank2Penalty;
    events.push({
      type: 'punishment-chain-increased',
      payload: { amount: chain.amount },
    });

    return { chain, events };
  }

  /**
   * Handle 2 starting new chain
   */
  private static handleRank2StartChain(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[]
  ) {
    chain.active = true;
    chain.amount = config.punishment.rank2Penalty;
    chain.cards = [];
    events.push({
      type: 'punishment-chain-started',
      payload: { amount: chain.amount },
    });

    return { chain, events };
  }

  /**
   * Handle chain ending (non-punishment card played)
   */
  private static handleChainEnd(
    chain: GameState['punishmentChain'],
    events: GameEvent[]
  ) {
    // Chain ends - should have been taken
    chain.active = false;
    chain.amount = 0;
    chain.cards = [];

    return { chain, events };
  }

  /**
   * Take punishment cards
   */
  static takePunishment(
    state: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const player = state.players.find((p:any) => p.id === playerId);

    if (!player) {
      throw new Error('Player not found');
    }

    const amount = state.punishmentChain.amount;
    const drawnCards = this.drawCards(state, amount);
    player.cards.push(...drawnCards);

    events.push({
      type: 'punishment_taken',
      playerId: playerId,
      amount: amount,
    });

    events.push({
      type: 'punishment-taken',
      payload: {
        playerId: playerId,
        amount: amount,
      },
    });

    // Reset punishment chain
    state.punishmentChain = {
      active: false,
      amount: 0,
      cards: [],
    };

    return { updatedState: state, events };
  }

  /**
   * Draw cards from deck
   */
  private static drawCards(state: GameState, amount: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < amount; i++) {
      if (state.deck.length === 0) {
        // Reshuffle pile into deck (keep top card)
        if (state.pile.length > 1) {
          const topCard = state.pile.pop()!;
          state.deck = this.shuffleDeck(state.pile);
          state.pile = [topCard];
        } else {
          // No more cards available
          break;
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
}
