import type { GameState, RuleConfig, Card, GameEvent, Suit } from '../types/game.types';
import { MoveValidator } from './validators/move.validator';
import { PunishmentChainManager } from './handlers/punishment.handler';
import { SpecialEffectsHandler } from './handlers/special-effects.handler';
import { CrazyChallengeHandler } from './handlers/crazy-challenge.handler';
import { GameStateManager } from './managers/game-state.manager';

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
   * Validate if a player can play cards
   */
  static validateMove(gameState: GameState, playerId: string, cards: Card[]): {
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
    chosenSuit?: Suit
  ): { updatedState: GameState; events: GameEvent[] } {
    const config = this.mergeConfig(gameState.ruleConfig);
    const newState = GameStateManager.cloneState(gameState);
    const events: GameEvent[] = [];

    // Remove cards from player's hand
    const player = newState.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    for (const card of cards) {
      const cardIndex = player.cards.findIndex(c => c.id === card.id);
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

    // Apply special card effects (if not in punishment chain)
    if (!newState.punishmentChain.active) {
      const effectsResult = SpecialEffectsHandler.applyEffects(
        newState,
        lastCard,
        config,
        chosenSuit
      );
      events.push(...effectsResult.events);
      Object.assign(newState, effectsResult.stateChanges);
    }

    // Check win condition
    if (config.winOnEmpty && player.cards.length === 0) {
      events.push({
        type: 'win',
        playerId,
        playerName: player.username,
      });
      newState.gameEnded = true;
    }

    // Advance turn (unless skipped or game ended)
    if (!newState.gameEnded && !events.some(e => e.type === 'skip')) {
      GameStateManager.advanceTurn(newState);
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
    
    // Advance turn
    GameStateManager.advanceTurn(result.updatedState);

    return result;
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
    
    const player = newState.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error('Player not found');
    }

    // Draw one card from deck
    if (newState.deck.length === 0) {
      // Reshuffle pile into deck (keep top card)
      if (newState.pile.length > 1) {
        const topCard = newState.pile.pop()!;
        newState.deck = this.shuffleDeck([...newState.pile]);
        newState.pile = [topCard];
      }
    }

    if (newState.deck.length > 0) {
      const drawnCard = newState.deck.pop()!;
      player.cards.push(drawnCard);

      events.push({
        type: 'cards_drawn',
        playerId: playerId,
        amount: 1,
      });
    }

    // Advance turn after drawing
    GameStateManager.advanceTurn(newState);

    return { updatedState: newState, events };
  }

  /**
   * Shuffle deck helper
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

    const playersWithCards = state.players.filter(p => p.cards.length > 0);
    
    if (playersWithCards.length === 0) {
      return { ended: true };
    }

    if (playersWithCards.length === 1 && state.players.length > 1) {
      return { ended: true, winner: playersWithCards[0].id };
    }

    return { ended: false };
  }
}
