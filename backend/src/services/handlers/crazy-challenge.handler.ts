import type { GameState, RuleConfig, GameEvent } from '../../types/game.types';
import { CardService } from '../card.service';

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
    const drawnCards = CardService.drawCards(gameState, config.illegalTurnPenalty);
    player.cards.push(...drawnCards);

    events.push({
      type: 'cards_drawn',
      playerId: playerId,
      amount: config.illegalTurnPenalty,
    });

    return { updatedState: gameState, events };
  }

  /**
   * Apply crazy challenge
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

    const penalty = config.crazyChallenge.penalty;
    const drawnCards = CardService.drawCards(gameState, penalty);
    player.cards.push(...drawnCards);

    if (challengedBy && challengedBy !== playerId) {
      events.push({
        type: 'crazy-called',
        payload: {
          success: true,
          callerId: challengedBy,
          targetId: playerId,
          penalty: penalty,
        },
      });
    } else {
      events.push({
        type: 'crazy-called',
        payload: {
          success: false,
          callerId: playerId,
          targetId: playerId,
          penalty: penalty,
        },
      });
    }

    events.push({
      type: 'cards_drawn',
      playerId: playerId,
      amount: penalty,
    });

    return { updatedState: gameState, events };
  }
}
