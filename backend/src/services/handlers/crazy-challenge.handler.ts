import type { GameState, RuleConfig, GameEvent } from '../../types/game.types';

/**
 * CrazyChallengeHandler - Handles crazy challenge mechanics
 */
export class CrazyChallengeHandler {
  /**
   * Apply illegal turn penalty (when challenged)
   */
  static applyIllegalTurnPenalty(
    gameState: GameState,
    playerId: string,
    calledBy: string,
    config: RuleConfig
  ): { updatedState: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const player = gameState.players.find(p => p.id === playerId);

    if (!player) {
      throw new Error('Player not found');
    }

    // Emit legacy event
    events.push({
      type: 'crazy_called',
      playerId: playerId,
      calledBy: calledBy,
      penalty: config.illegalTurnPenalty,
    });

    // Emit new format event
    events.push({
      type: 'crazy-called',
      payload: {
        success: true,
        callerId: calledBy,
        targetId: playerId,
        penalty: config.illegalTurnPenalty,
      },
    });

    // Player draws penalty cards
    const drawnCards = this.drawCards(gameState, config.illegalTurnPenalty);
    player.cards.push(...drawnCards);

    events.push({
      type: 'cards_drawn',
      playerId: playerId,
      amount: config.illegalTurnPenalty,
    });

    return { updatedState: gameState, events };
  }

  /**
   * Apply crazy challenge (self-challenge or other)
   */
  static applyCrazyChallenge(
    gameState: GameState,
    playerId: string,
    challengedBy: string | undefined,
    config: RuleConfig
  ): { updatedState: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const player = gameState.players.find(p => p.id === playerId);

    if (!player) {
      throw new Error('Player not found');
    }

    if (challengedBy && challengedBy !== playerId) {
      // Someone else challenged
      const drawnCards = this.drawCards(gameState, config.crazyChallenge.penalty);
      player.cards.push(...drawnCards);

      events.push({
        type: 'crazy-called',
        payload: {
          success: true,
          callerId: challengedBy,
          targetId: playerId,
          penalty: config.crazyChallenge.penalty,
        },
      });
    } else {
      // Self-challenge or auto-challenge
      const drawnCards = this.drawCards(gameState, config.crazyChallenge.penalty);
      player.cards.push(...drawnCards);

      events.push({
        type: 'crazy-called',
        payload: {
          success: false,
          callerId: playerId,
          targetId: playerId,
          penalty: config.crazyChallenge.penalty,
        },
      });
    }

    return { updatedState: gameState, events };
  }

  /**
   * Draw cards from deck
   */
  private static drawCards(state: GameState, amount: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < amount; i++) {
      if (state.deck.length === 0) {
        if (state.pile.length > 1) {
          const topCard = state.pile.pop()!;
          state.deck = this.shuffleDeck(state.pile);
          state.pile = [topCard];
        } else {
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

import type { Card } from '../../types/game.types';
