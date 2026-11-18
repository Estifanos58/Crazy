import type { Card, GameEvent, GameState, RuleConfig, Suit } from '../types/game.types';
import { MoveValidator } from './validators/move.validator';
import { PunishmentChainManager } from './handlers/punishment.handler';
import { SpecialEffectsHandler } from './handlers/special-effects.handler';
import { CrazyChallengeHandler } from './handlers/crazy-challenge.handler';
import { GameStateManager } from './managers/game-state.manager';
import { CardService } from './card.service';

/**
 * RuleService - Main orchestrator for game rules
 */
export class RuleService {
  /**
   * Default rule configuration
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
        reverseCards: [{ rank: '5' }],
        skipCards: [{ rank: '7' }],
        suitChangeCards: [{ rank: 'J' }, { rank: '8' }],
        dropCards: { rank: '7' },
      },
      crazyChallenge: {
        enabled: true,
        penalty: 2,
        responseTimeMs: 3000,
      },
      illegalTurnPenalty: 2,
      allowDropAllSameSuit: true,
      winOnEmpty: true,
    };
  }

  /**
   * Merge custom rules with defaults safely
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
   * Validate if a player can play cards
   */
  static validateMove(
    gameState: GameState,
    playerId: string,
    cards: Card[]
  ): {
    valid: boolean;
    errors?: string[];
    canChallengeCrazy?: boolean;
  } {
    const config = this.mergeConfig(gameState.ruleConfig);
    return MoveValidator.validateMove(gameState, playerId, cards, config);
  }

  /**
   * Apply card effects and update game state
   */
  static applyCardEffects(
    gameState: GameState,
    playerId: string,
    cards: Card[],
    chosenSuit?: Suit,
    multipleCards = false
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = GameStateManager.cloneState(gameState);
    const events: GameEvent[] = [];

    // Capture active player count BEFORE removing played cards (needed for 2-player reverse rule)
    const activePlayerCountBefore = newState.players.filter((p) => p.cards.length > 0).length;

    // Remove cards from player's hand
    const player = newState.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');

    for (const card of cards) {
      const cardIndex = player.cards.findIndex((c) => c.id === card.id);
      if (cardIndex !== -1) {
        player.cards.splice(cardIndex, 1);
      }
    }

    // Add cards to pile
    newState.pile.push(...cards);

    // Emit card-played event
    events.push({
      type: 'card-played',
      payload: { playerId, cards },
    });

    // Update current suit
    const lastCard = cards[cards.length - 1];
    newState.currentSuit = chosenSuit || lastCard.suit;

    // Process punishment chain
    const punishmentResult = PunishmentChainManager.processPunishmentChain(
      newState,
      lastCard,
      config
    );
    newState.punishmentChain = punishmentResult.chain;
    events.push(...punishmentResult.events);

    // Track special effects for turn handling
    let isReverse = false;
    let isSkip = false;
    let reverseActsAsSkip = false;

    // Apply special card effects (if not in punishment chain)
    if (!newState.punishmentChain.active) {
      const effectsResult = SpecialEffectsHandler.applyEffects(
        newState,
        lastCard,
        config,
        chosenSuit,
        multipleCards,
        playerId,
        activePlayerCountBefore
      );
      events.push(...effectsResult.events);
      Object.assign(newState, effectsResult.stateChanges);
      isReverse = effectsResult.isReverse;
      isSkip = effectsResult.isSkip;
      reverseActsAsSkip = effectsResult.reverseActsAsSkip;
    } else {
      newState.lastSuitChangedBy = undefined;
    }

    // Check if player finished (ran out of cards)
    const playerFinished = config.winOnEmpty && player.cards.length === 0;

    if (playerFinished) {
      events.push({
        type: 'win',
        playerId,
        playerName: player.username,
      });

      const activePlayers = newState.players.filter((p) => p.cards.length > 0);
      if (activePlayers.length <= 1) {
        newState.gameEnded = true;
      }
    }

    // Handle turn advancement accurately for both continuing and finishing players
    if (!newState.gameEnded) {
      if (isReverse && reverseActsAsSkip) {
        // 2-player reverse acts as a skip: skip opponent, land on acting player (if active)
        newState.currentTurn = GameStateManager.getNextActivePlayerFrom(newState, playerId, 2);
      } else if (isReverse) {
        // 3+ player reverse: direction already flipped; advance 1 active step in new direction
        newState.currentTurn = GameStateManager.getNextActivePlayerFrom(newState, playerId, 1);
      } else if (isSkip) {
        // Skip card: skip next active player, land on the active player after them
        newState.currentTurn = GameStateManager.getNextActivePlayerFrom(newState, playerId, 2);
      } else {
        // Normal turn advancement: next active player in current direction
        newState.currentTurn = GameStateManager.getNextActivePlayerFrom(newState, playerId, 1);
      }
    }

    return { updatedState: newState, events };
  }

  /**
   * Handle taking punishment cards
   */
  static takePunishmentCards(
    gameState: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const newState = GameStateManager.cloneState(gameState);
    const result = PunishmentChainManager.takePunishment(newState, playerId);

    GameStateManager.advanceTurn(result.updatedState);

    return result;
  }

  /**
   * Handle taking punishment cards WITHOUT advancing turn
   */
  static takePunishmentCardsNoAdvance(
    gameState: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const newState = GameStateManager.cloneState(gameState);
    return PunishmentChainManager.takePunishment(newState, playerId);
  }

  /**
   * Draw a single card (when player has no playable card)
   */
  static drawSingleCard(
    gameState: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const newState = GameStateManager.cloneState(gameState);
    const events: GameEvent[] = [];

    const player = newState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const drawnCards = CardService.drawCards(newState, 1);
    if (drawnCards.length > 0) {
      player.cards.push(...drawnCards);
      events.push({
        type: 'cards_drawn',
        playerId,
        amount: drawnCards.length,
      });
    }

    // Advance turn after drawing
    GameStateManager.advanceTurn(newState);

    return { updatedState: newState, events };
  }

  /**
   * Draw a single card WITHOUT advancing turn
   */
  static drawSingleCardNoAdvance(
    gameState: GameState,
    playerId: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const newState = GameStateManager.cloneState(gameState);
    const events: GameEvent[] = [];

    const player = newState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const drawnCards = CardService.drawCards(newState, 1);
    if (drawnCards.length > 0) {
      player.cards.push(...drawnCards);
      events.push({
        type: 'cards_drawn',
        playerId,
        amount: drawnCards.length,
      });
    }

    return { updatedState: newState, events };
  }

  /**
   * Handle illegal turn penalty
   */
  static applyIllegalTurnPenalty(
    gameState: GameState,
    playerId: string,
    calledBy: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = GameStateManager.cloneState(gameState);

    return CrazyChallengeHandler.applyIllegalTurnPenalty(
      newState,
      playerId,
      calledBy,
      config
    );
  }

  /**
   * Handle crazy challenge
   */
  static applyCrazyChallenge(
    gameState: GameState,
    playerId: string,
    challengedBy?: string
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = GameStateManager.cloneState(gameState);

    return CrazyChallengeHandler.applyCrazyChallenge(
      newState,
      playerId,
      challengedBy,
      config
    );
  }

  /**
   * Check if game has ended
   */
  static checkGameEnd(state: GameState): { ended: boolean; winner?: string } {
    const config = this.mergeConfig(state.ruleConfig);

    if (!config.winOnEmpty) {
      return { ended: false };
    }

    const playersWithCards = state.players.filter((p) => p.cards.length > 0);

    if (playersWithCards.length === 0) {
      return { ended: true };
    }

    if (playersWithCards.length === 1 && state.players.length > 1) {
      return { ended: true, winner: playersWithCards[0].id };
    }

    return { ended: false };
  }
}
