import type { Card, GameEvent, GameState, RuleConfig } from '../../types/game.types';
import { matchesCardSelector } from '../../utils/card-selector';
import { CardService } from '../card.service';

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
    const chain = {
      ...state.punishmentChain,
      cards: [...state.punishmentChain.cards],
    };

    const isAceSpade =
      config.punishment.aceSpadePenalty > 0 &&
      matchesCardSelector(card, config.punishment.aceSpadeCard);
    const isRank2 =
      config.punishment.rank2Penalty > 0 && config.punishment.rank2Cards.includes(card.rank);

    if (isAceSpade) {
      return this.handleAceSpade(chain, config, events, card);
    } else if (isRank2 && chain.active) {
      return this.handleRank2OnActiveChain(chain, config, events, card);
    } else if (isRank2 && !chain.active) {
      return this.handleRank2StartChain(chain, config, events, card);
    } else if (chain.active) {
      return this.handleChainEnd(chain, events);
    }

    return { chain, events };
  }

  private static handleAceSpade(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[],
    card: Card
  ) {
    if (chain.active) {
      chain.amount += config.punishment.aceSpadePenalty;
      chain.cards.push(card);
      events.push({
        type: 'punishment-chain-increased',
        payload: { amount: chain.amount },
      });
    } else {
      chain.active = true;
      chain.amount = config.punishment.aceSpadePenalty;
      chain.cards = [card];
      events.push({
        type: 'punishment-chain-started',
        payload: { amount: chain.amount },
      });
    }

    return { chain, events };
  }

  private static handleRank2OnActiveChain(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[],
    card: Card
  ) {
    chain.amount += config.punishment.rank2Penalty;
    chain.cards.push(card);
    events.push({
      type: 'punishment-chain-increased',
      payload: { amount: chain.amount },
    });

    return { chain, events };
  }

  private static handleRank2StartChain(
    chain: GameState['punishmentChain'],
    config: RuleConfig,
    events: GameEvent[],
    card: Card
  ) {
    chain.active = true;
    chain.amount = config.punishment.rank2Penalty;
    chain.cards = [card];
    events.push({
      type: 'punishment-chain-started',
      payload: { amount: chain.amount },
    });

    return { chain, events };
  }

  private static handleChainEnd(
    chain: GameState['punishmentChain'],
    events: GameEvent[]
  ) {
    chain.active = false;
    chain.amount = 0;
    chain.cards = [];

    return { chain, events };
  }

  /**
   * Take punishment cards and emit authoritative actual drawn count
   */
  static takePunishment(
    state: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const player = state.players.find((p) => p.id === playerId);

    if (!player) {
      throw new Error('Player not found');
    }

    const amount = state.punishmentChain.amount;
    const drawnCards = CardService.drawCards(state, amount);
    player.cards.push(...drawnCards);
    const actualDrawn = drawnCards.length;

    events.push({
      type: 'cards_drawn',
      playerId,
      amount: actualDrawn,
    });

    events.push({
      type: 'punishment-taken',
      payload: {
        playerId,
        amount: actualDrawn,
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
}
