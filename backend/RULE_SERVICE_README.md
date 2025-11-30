# 🎮 Crazy Card Game - Rule Service Documentation

## Overview

The **RuleService** is a comprehensive, fully configurable rule engine for the Crazy multiplayer card game. It implements all game mechanics as defined in `rules.md` and allows room creators to customize every aspect of gameplay.

## 🌟 Features

- ✅ **Fully Configurable**: Every rule can be adjusted by the room creator
- ✅ **Punishment Chain System**: A♠ + 2s combo with stackable penalties
- ✅ **Special Card Effects**: Reverse, Skip, Suit Change
- ✅ **Crazy Challenge Mechanics**: Wrong suit detection with response system
- ✅ **Validation Engine**: Move validation before execution
- ✅ **Event System**: Clean event emission for UI updates
- ✅ **Stateless Functions**: No side effects, always returns new state
- ✅ **Socket-Safe**: All data structures are JSON-serializable
- ✅ **Preset System**: Pre-configured rule sets (Standard, Hardcore, Beginner, etc.)

---

## 📦 Core Components

### 1. **RuleService** (`src/services/rule.service.ts`)

Main rule engine with static methods for game logic.

#### Key Methods:

```typescript
// Get default configuration
RuleService.getDefaultConfig(): RuleConfig

// Merge custom config with defaults
RuleService.mergeConfig(customConfig?: Partial<RuleConfig>): RuleConfig

// Validate a move before execution
RuleService.validateMove(gameState: GameState, playerId: string, cards: Card[]): RuleValidationResult

// Apply card effects and update state
RuleService.applyCardEffects(
  gameState: GameState,
  playerId: string,
  cards: Card[],
  chosenSuit?: Suit
): { updatedState: GameState; events: GameEvent[] }

// Handle punishment cards
RuleService.takePunishmentCards(gameState: GameState, playerId: string): { updatedState: GameState; events: GameEvent[] }

// Handle crazy challenges
RuleService.applyCrazyChallenge(gameState: GameState, playerId: string, challengedBy?: string): { updatedState: GameState; events: GameEvent[] }

// Handle illegal turn
RuleService.applyIllegalTurnPenalty(gameState: GameState, playerId: string, calledBy: string): { updatedState: GameState; events: GameEvent[] }
```

---

### 2. **RuleBuilder** (`src/utils/rule-builder.ts`)

Fluent API for building custom rule configurations.

#### Example Usage:

```typescript
const customRules = new RuleBuilder()
  .setPunishmentCard('A', 'hearts', 7)  // A♥ gives 7 cards
  .setRank2Cards(['3'], 2)              // 3s act as 2s
  .setReverseCard('Q')                   // Queens reverse
  .setSkipCard('K')                      // Kings skip
  .setSuitChangeCards([{ rank: 'J' }])   // Only Jacks change suit
  .setCrazyChallenge(true, 3, 2000)      // 3 cards, 2 sec window
  .setIllegalTurnPenalty(3)
  .setAllowDropAllSameSuit(true)
  .build();
```

---

### 3. **RulePresets** (`src/utils/rule-builder.ts`)

Pre-configured rule sets for quick game setup.

```typescript
RulePresets.standard()   // Default Crazy rules
RulePresets.hardcore()   // Higher penalties (A♠=7, 2s=3, etc.)
RulePresets.beginner()   // Lower penalties (A♠=3, 2s=1, etc.)
RulePresets.chaos()      // Multiple special cards (Q reverse, K skip, etc.)
RulePresets.classic()    // No special cards, pure strategy
```

---

### 4. **RuleValidator** (`src/utils/rule-builder.ts`)

Validation and sanitization utilities.

```typescript
// Validate custom rules
const validation = RuleValidator.validate(customRules);
if (!validation.valid) {
  console.error(validation.errors);
}

// Sanitize invalid values (negative penalties → 0)
const safe = RuleValidator.sanitize(customRules);
```

---

## 🎯 Rule Configuration Structure

```typescript
interface RuleConfig {
  punishment: {
    aceSpadeCard: CardSelector;        // Default: { rank: 'A', suit: 'spades' }
    aceSpadePenalty: number;           // Default: 5 cards
    rank2Cards: Rank[];                // Default: ['2']
    rank2Penalty: number;              // Default: 2 cards
  };
  
  specialCards: {
    reverseCards: CardSelector[];      // Default: [{ rank: '5' }]
    skipCards: CardSelector[];         // Default: [{ rank: '7' }]
    suitChangeCards: CardSelector[];   // Default: [{ rank: 'J' }, { rank: '8' }]
  };
  
  crazyChallenge: {
    enabled: boolean;                  // Default: true
    penalty: number;                   // Default: 2 cards
    responseTimeMs: number;            // Default: 3000ms
  };
  
  illegalTurnPenalty: number;          // Default: 2 cards
  allowDropAllSameSuit: boolean;       // Default: true
  winOnEmpty: boolean;                 // Default: true
}
```

### CardSelector

Allows specifying cards by rank only (affects all suits) or by specific rank+suit:

```typescript
{ rank: '5' }                // All 5s
{ rank: 'A', suit: 'spades' } // Only A♠
```

---

## 🎲 Game Rules Implementation

### 1️⃣ **A♠ Punishment Rule**

```typescript
// Default: A♠ gives 5 cards
// Customize:
.setPunishmentCard('A', 'hearts', 10)  // A♥ gives 10 cards
```

**Chain Logic:**
- A♠ played → 5 cards
- Next player plays 2♠ → 5 + 2 = 7 cards
- Next player plays 2♥ → 7 + 2 = 9 cards
- Next player must take 9 OR play another 2

### 2️⃣ **Rank-2 Punishment Rule**

```typescript
// Default: 2s give 2 cards
// Customize:
.setRank2Cards(['2', '3'], 3)  // 2s and 3s give 3 cards each
```

### 3️⃣ **Illegal Turn Rule ("Crazy" Call)**

If player plays out of turn:
- Other players can call "Crazy"
- Player receives 2 cards (configurable)

```typescript
.setIllegalTurnPenalty(3)  // 3 cards instead of 2
```

### 4️⃣ **Reverse Rule**

```typescript
// Default: All 5s reverse
.setReverseCard('Q')  // Queens reverse instead
```

### 5️⃣ **Skip Rule**

```typescript
// Default: All 7s skip
.setSkipCard('K')  // Kings skip instead

// Multi-card drop:
// Player can drop all hearts if they play 7♥
.setAllowDropAllSameSuit(true)
```

### 6️⃣ **Suit Change Rule**

```typescript
// Default: J and 8 change suit
.setSuitChangeCards([{ rank: 'A' }])  // Only Aces change suit
```

### 7️⃣ **Crazy Challenge Rule**

When player drops wrong suit:
- Other players see "Crazy" button
- First to click wins
- If player clicks first: card returns to hand
- If opponent clicks first: player takes 2 cards

```typescript
.setCrazyChallenge(true, 3, 2000)  // 3 cards, 2-second window
```

### 8️⃣ **Win Condition**

```typescript
.setWinOnEmpty(true)   // First to empty hand wins
.setWinOnEmpty(false)  // Last with cards loses
```

---

## 🚀 Quick Start

### Backend Integration

```typescript
import { RoomService } from './services/room.service';
import { RulePresets } from './utils/rule-builder';

// Start game with preset
socket.on('start-game', async (data) => {
  const result = await RoomService.startGame({
    roomId: data.roomId,
    cardsPerPlayer: 7,
    ruleConfig: RulePresets.hardcore()  // Use preset
  });
});
```

### Frontend - Custom Rules

```typescript
import { RuleBuilder } from './utils/rule-builder';

// User creates custom rules in UI
const customRules = new RuleBuilder()
  .setPunishmentCard('A', 'spades', 5)
  .setReverseCard('5')
  .build();

// Send to backend
socket.emit('start-game', {
  roomId: 'ABC123',
  cardsPerPlayer: 7,
  ruleConfig: customRules
});
```

### Frontend - Preset Selector

```typescript
const presets = [
  { id: 'standard', name: 'Standard', config: RulePresets.standard() },
  { id: 'hardcore', name: 'Hardcore', config: RulePresets.hardcore() },
  { id: 'beginner', name: 'Beginner', config: RulePresets.beginner() },
  { id: 'chaos', name: 'Chaos Mode', config: RulePresets.chaos() },
];

// User selects preset from dropdown
const selectedConfig = presets.find(p => p.id === userSelection)?.config;
```

---

## 🎮 Game Flow

### 1. **Validate Move**

```typescript
const validation = RuleService.validateMove(gameState, playerId, [card]);

if (!validation.valid) {
  return { error: validation.errors.join(', ') };
}
```

### 2. **Apply Card Effects**

```typescript
const { updatedState, events } = RuleService.applyCardEffects(
  gameState,
  playerId,
  [card],
  chosenSuit  // Optional: for suit change cards
);
```

### 3. **Broadcast Events**

```typescript
events.forEach(event => {
  io.to(roomId).emit('game-event', event);
});
```

### 4. **Update Players**

```typescript
players.forEach(player => {
  io.to(player.id).emit('game-update', {
    yourCards: player.cards,
    currentTurn: updatedState.currentTurn,
    currentSuit: updatedState.currentSuit,
    punishmentChain: updatedState.punishmentChain,
  });
});
```

---

## 📊 Event Types

```typescript
type GameEvent =
  | { type: 'punishment_added'; card: Card; totalPunishment: number }
  | { type: 'take_punishment'; playerId: string; amount: number }
  | { type: 'punishment_taken'; playerId: string; amount: number }
  | { type: 'reverse'; newDirection: 'clockwise' | 'counterclockwise' }
  | { type: 'skip'; skippedPlayerId: string }
  | { type: 'suit_change'; newSuit: Suit; card: Card }
  | { type: 'crazy_called'; playerId: string; calledBy: string }
  | { type: 'crazy_challenge_lost'; playerId: string; challengedBy: string }
  | { type: 'crazy_challenge_won'; playerId: string }
  | { type: 'cards_drawn'; playerId: string; amount: number }
  | { type: 'win'; playerId: string; playerName: string }
```

---

## 🧪 Testing

See `src/examples/rule-examples.ts` for comprehensive usage examples covering:

1. Default rules
2. Custom rules with RuleBuilder
3. Preset usage
4. Move validation
5. Card playing
6. Punishment chains
7. Crazy challenges
8. Multi-card drops
9. Rule validation
10. Frontend integration
11. Advanced custom rules
12. Preset selector UI

---

## 🔧 Advanced Customization

### Specific Card Effects

Apply effects to specific suit+rank combinations:

```typescript
new RuleBuilder()
  .addReverseCards([
    { rank: '5', suit: 'hearts' },  // Only 5♥ reverses
    { rank: 'Q', suit: 'spades' }   // Q♠ also reverses
  ])
  .build();
```

### Custom Punishment Chains

```typescript
new RuleBuilder()
  .setPunishmentCard('K', 'clubs', 10)  // K♣ gives 10 cards
  .setRank2Cards(['3', '4'], 3)         // 3s and 4s add 3 each
  .build();
```

### Disable Features

```typescript
new RuleBuilder()
  .setCrazyChallenge(false, 0, 0)       // No crazy challenges
  .setAllowDropAllSameSuit(false)       // No multi-card drops
  .setSuitChangeCards([])               // No suit changes
  .build();
```

---

## 📝 Type Definitions

All types are in `src/types/game.types.ts`:

- `RuleConfig` - Complete rule configuration
- `GameState` - Full game state
- `GameEvent` - Event emissions
- `RuleValidationResult` - Validation results
- `CardSelector` - Card selection for rules
- `PunishmentChain` - Chain state

---

## 🎉 Summary

The RuleService provides a **complete, production-ready** implementation of all Crazy game rules with:

✅ Full customization support  
✅ Clean, stateless API  
✅ Comprehensive validation  
✅ Event-driven architecture  
✅ Socket.IO integration  
✅ TypeScript type safety  
✅ Extensive examples  
✅ Preset system  

**Ready to integrate into your game!** 🚀
