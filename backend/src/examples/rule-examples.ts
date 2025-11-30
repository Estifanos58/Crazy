/**
 * RULE SERVICE USAGE EXAMPLES
 * 
 * This file demonstrates how to use the RuleService, RuleBuilder,
 * and RulePresets to create custom game rules.
 */

import { RuleService } from '../services/rule.service';
import { RuleBuilder, RulePresets, RuleValidator } from '../utils/rule-builder';
import type { RuleConfig, GameState, Card } from '../types/game.types';

// ============================================
// EXAMPLE 1: Using Default Rules
// ============================================

function example1_DefaultRules() {
  const defaultConfig = RuleService.getDefaultConfig();
  
  console.log('Default Rules:');
  console.log('- A♠ gives:', defaultConfig.punishment.aceSpadePenalty, 'cards');
  console.log('- 2s give:', defaultConfig.punishment.rank2Penalty, 'cards each');
  console.log('- Reverse card:', defaultConfig.specialCards.reverseCards[0].rank);
  console.log('- Skip card:', defaultConfig.specialCards.skipCards[0].rank);
  console.log('- Suit change cards:', defaultConfig.specialCards.suitChangeCards.map(c => c.rank).join(', '));
  
  return defaultConfig;
}

// ============================================
// EXAMPLE 2: Custom Rules with RuleBuilder
// ============================================

function example2_CustomRules() {
  // Create custom rules where:
  // - A♥ gives 7 cards (instead of A♠)
  // - 3s act as punishment cards (2 cards each)
  // - Queens reverse direction
  // - Kings skip next player
  const customRules = new RuleBuilder()
    .setPunishmentCard('A', 'hearts', 7) // A♥ = 7 cards
    .setRank2Cards(['3'], 2) // 3s give 2 cards
    .setReverseCard('Q') // Queens reverse
    .setSkipCard('K') // Kings skip
    .setSuitChangeCards([{ rank: 'J' }]) // Only Jacks change suit
    .setCrazyChallenge(true, 3, 2000) // 3 cards penalty, 2 second window
    .setIllegalTurnPenalty(3)
    .build();

  console.log('Custom Rules Created:', customRules);
  
  return customRules;
}

// ============================================
// EXAMPLE 3: Using Presets
// ============================================

function example3_Presets() {
  // Standard mode
  const standard = RulePresets.standard();
  console.log('Standard Mode:', standard);
  
  // Hardcore mode (higher penalties)
  const hardcore = RulePresets.hardcore();
  console.log('Hardcore Mode:', hardcore);
  
  // Beginner mode (lower penalties)
  const beginner = RulePresets.beginner();
  console.log('Beginner Mode:', beginner);
  
  // Chaos mode (multiple special cards)
  const chaos = RulePresets.chaos();
  console.log('Chaos Mode:', chaos);
  
  // Classic mode (no special cards)
  const classic = RulePresets.classic();
  console.log('Classic Mode:', classic);
  
  return { standard, hardcore, beginner, chaos, classic };
}

// ============================================
// EXAMPLE 4: Validating a Move
// ============================================

function example4_ValidateMove(gameState: GameState, playerId: string, cards: Card[]) {
  const validation = RuleService.validateMove(gameState, playerId, cards);
  
  if (validation.valid) {
    console.log('✅ Move is valid!');
  } else {
    console.log('❌ Move is invalid:', validation.errors);
    
    if (validation.canChallengeCrazy) {
      console.log('⚠️ Other players can call "Crazy"');
    }
    
    if (validation.mustTakeCards) {
      console.log(`📥 Must take ${validation.mustTakeCards} cards`);
    }
  }
  
  return validation;
}

// ============================================
// EXAMPLE 5: Playing a Card
// ============================================

function example5_PlayCard(
  gameState: GameState,
  playerId: string,
  cards: Card[],
  chosenSuit?: 'hearts' | 'diamonds' | 'clubs' | 'spades'
) {
  // First validate
  const validation = RuleService.validateMove(gameState, playerId, cards);
  
  if (!validation.valid) {
    console.error('Cannot play card:', validation.errors);
    return null;
  }
  
  // Apply card effects
  const { updatedState, events } = RuleService.applyCardEffects(
    gameState,
    playerId,
    cards,
    chosenSuit
  );
  
  console.log('Card played successfully!');
  console.log('Events triggered:', events);
  console.log('New turn:', updatedState.currentTurn);
  console.log('Current suit:', updatedState.currentSuit);
  
  return { updatedState, events };
}

// ============================================
// EXAMPLE 6: Punishment Chain
// ============================================

function example6_PunishmentChain() {
  /**
   * Scenario: 
   * Player 1 plays A♠ (5 cards)
   * Player 2 plays 2♠ (now 7 cards)
   * Player 3 plays 2♥ (now 9 cards)
   * Player 4 must take 9 cards OR play another 2
   */
  
  const mockGameState: Partial<GameState> = {
    punishmentChain: {
      active: true,
      amount: 9,
      cards: [
        { id: 'A-spades', rank: 'A', suit: 'spades' },
        { id: '2-spades', rank: '2', suit: 'spades' },
        { id: '2-hearts', rank: '2', suit: 'hearts' },
      ],
    },
  };
  
  console.log('Punishment Chain Active:', mockGameState.punishmentChain);
  console.log('Player must take 9 cards or play a 2');
  
  return mockGameState;
}

// ============================================
// EXAMPLE 7: Handling Crazy Challenge
// ============================================

function example7_CrazyChallenge(gameState: GameState, playerId: string, challengedBy?: string) {
  const { updatedState, events } = RuleService.applyCrazyChallenge(
    gameState,
    playerId,
    challengedBy
  );
  
  if (challengedBy) {
    console.log(`${playerId} lost crazy challenge! Called by ${challengedBy}`);
  } else {
    console.log(`${playerId} won crazy challenge! Called crazy on themselves first`);
  }
  
  console.log('Events:', events);
  
  return { updatedState, events };
}

// ============================================
// EXAMPLE 8: Multiple Cards (Same Suit with 7)
// ============================================

function example8_MultipleCards() {
  /**
   * If allowDropAllSameSuit is enabled,
   * player can play multiple cards of the same suit
   * along with a 7 (skip card)
   */
  
  const cards: Card[] = [
    { id: '7-hearts', rank: '7', suit: 'hearts' },
    { id: '3-hearts', rank: '3', suit: 'hearts' },
    { id: 'K-hearts', rank: 'K', suit: 'hearts' },
  ];
  
  console.log('Playing multiple hearts with 7♥');
  console.log('All cards must be the same suit');
  console.log('Requires allowDropAllSameSuit: true in config');
  
  return cards;
}

// ============================================
// EXAMPLE 9: Custom Rule Validation
// ============================================

function example9_ValidateCustomRules() {
  const invalidRules = new RuleBuilder()
    .setPunishmentCard('A', 'spades', -5) // Negative penalty!
    .setCrazyChallenge(true, -2, -1000) // Negative values!
    .build();
  
  const validation = RuleValidator.validate(invalidRules);
  
  if (!validation.valid) {
    console.log('❌ Invalid rules:', validation.errors);
    
    // Sanitize the rules
    const sanitized = RuleValidator.sanitize(invalidRules);
    console.log('✅ Sanitized rules:', sanitized);
  }
  
  return validation;
}

// ============================================
// EXAMPLE 10: Frontend Integration
// ============================================

function example10_FrontendUsage() {
  /**
   * Frontend can send custom rules when starting a game:
   */
  
  const frontendRequest = {
    roomId: 'ABC123',
    cardsPerPlayer: 7,
    ruleConfig: new RuleBuilder()
      .setPunishmentCard('A', 'spades', 5)
      .setRank2Cards(['2'], 2)
      .setReverseCard('5')
      .setSkipCard('7')
      .setSuitChangeCards([{ rank: 'J' }, { rank: '8' }])
      .build(),
  };
  
  console.log('Frontend sends this to start-game event:', frontendRequest);
  
  // Backend merges with defaults:
  const mergedConfig = RuleService.mergeConfig(frontendRequest.ruleConfig);
  console.log('Backend uses this config:', mergedConfig);
  
  return frontendRequest;
}

// ============================================
// EXAMPLE 11: Advanced Custom Rules
// ============================================

function example11_AdvancedRules() {
  /**
   * Create a game where:
   * - Only specific cards have effects (not all of a rank)
   * - A♠ gives 10 cards
   * - 2♠ specifically gives 5 cards (other 2s give 2)
   * - Only 5♥ reverses (not other 5s)
   */
  
  const advancedRules = new RuleBuilder()
    .setPunishmentCard('A', 'spades', 10)
    .setRank2Cards(['2'], 2)
    .addReverseCards([{ rank: '5', suit: 'hearts' }]) // Only 5♥
    .addSkipCards([{ rank: '7', suit: 'spades' }]) // Only 7♠
    .setSuitChangeCards([{ rank: 'J', suit: 'clubs' }]) // Only J♣
    .build();
  
  console.log('Advanced Rules:', advancedRules);
  console.log('Only specific suit+rank combinations have effects');
  
  return advancedRules;
}

// ============================================
// EXAMPLE 12: Rule Preset Selection UI
// ============================================

function example12_PresetSelector(presetName: string): Partial<RuleConfig> {
  const presets: { [key: string]: () => Partial<RuleConfig> } = {
    standard: RulePresets.standard,
    hardcore: RulePresets.hardcore,
    beginner: RulePresets.beginner,
    chaos: RulePresets.chaos,
    classic: RulePresets.classic,
  };
  
  const selectedPreset = presets[presetName];
  
  if (!selectedPreset) {
    console.error('Unknown preset:', presetName);
    return RulePresets.standard();
  }
  
  console.log(`Selected preset: ${presetName}`);
  return selectedPreset();
}

// ============================================
// EXPORT EXAMPLES
// ============================================

export const RuleExamples = {
  defaultRules: example1_DefaultRules,
  customRules: example2_CustomRules,
  presets: example3_Presets,
  validateMove: example4_ValidateMove,
  playCard: example5_PlayCard,
  punishmentChain: example6_PunishmentChain,
  crazyChallenge: example7_CrazyChallenge,
  multipleCards: example8_MultipleCards,
  validateRules: example9_ValidateCustomRules,
  frontendIntegration: example10_FrontendUsage,
  advancedRules: example11_AdvancedRules,
  presetSelector: example12_PresetSelector,
};

/**
 * Quick Start Guide for Frontend Developers:
 * 
 * 1. Import the RuleBuilder:
 *    import { RuleBuilder, RulePresets } from './utils/rule-builder';
 * 
 * 2. Create custom rules:
 *    const rules = new RuleBuilder()
 *      .setPunishmentCard('A', 'spades', 5)
 *      .setReverseCard('5')
 *      .build();
 * 
 * 3. Or use a preset:
 *    const rules = RulePresets.hardcore();
 * 
 * 4. Send with start-game event:
 *    socket.emit('start-game', {
 *      roomId: 'ABC123',
 *      cardsPerPlayer: 7,
 *      ruleConfig: rules
 *    });
 * 
 * 5. Backend automatically validates and applies rules!
 */
