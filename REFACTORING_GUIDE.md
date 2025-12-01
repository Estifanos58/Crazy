# Refactored Backend Architecture

## Overview
The backend has been refactored into smaller, focused components following the Single Responsibility Principle. Each component handles a specific aspect of the game logic.

## Directory Structure

```
backend/src/
├── controllers/
│   ├── socket.controller.ts (original - 466 lines)
│   ├── socket.controller.refactored.ts (new - 31 lines)
│   └── handlers/
│       ├── create-room.handler.ts (20 lines)
│       ├── join-room.handler.ts (50 lines)
│       ├── start-game.handler.ts (48 lines)
│       ├── play-card.handler.ts (97 lines)
│       ├── punishment.handler.ts (65 lines)
│       ├── crazy-call.handler.ts (48 lines)
│       ├── reconnection.handler.ts (68 lines)
│       └── blunder.handler.ts (88 lines)
├── services/
│   ├── rule.service.ts (original - 655 lines)
│   ├── rule.service.refactored.ts (new - 167 lines)
│   ├── validators/
│   │   └── move.validator.ts (168 lines)
│   ├── handlers/
│   │   ├── punishment.handler.ts (190 lines)
│   │   ├── special-effects.handler.ts (119 lines)
│   │   └── crazy-challenge.handler.ts (116 lines)
│   └── managers/
│       └── game-state.manager.ts (55 lines)
├── room.service.ts (180 lines - unchanged)
├── card.service.ts (57 lines - unchanged)
└── utils/
    └── rule-builder.ts (326 lines - unchanged)
```

## Component Breakdown

### Controllers Layer

#### `socket.controller.refactored.ts`
- **Purpose**: Main orchestrator for Socket.IO events
- **Size**: 31 lines (reduced from 466 lines - 93% reduction)
- **Responsibility**: Delegate to specific handlers
- **Dependencies**: All handler classes

#### Socket Handlers (controllers/handlers/)

1. **CreateRoomHandler** (20 lines)
   - Handles room creation
   - Emits room-created events

2. **JoinRoomHandler** (50 lines)
   - Handles joining rooms
   - Handles getting room info
   - Broadcasts player-joined events

3. **StartGameHandler** (48 lines)
   - Validates room creator
   - Starts game and distributes cards
   - Sends private game states to each player

4. **PlayCardHandler** (97 lines)
   - Validates and processes card plays
   - Detects blunders
   - Applies card effects
   - Broadcasts game updates

5. **PunishmentHandler** (65 lines)
   - Handles taking punishment cards
   - Updates game state
   - Advances turn

6. **CrazyCallHandler** (48 lines)
   - Handles "Crazy" challenges
   - Applies penalties
   - Broadcasts events

7. **ReconnectionHandler** (68 lines)
   - Handles player reconnection
   - Restores game state
   - Handles get-game-state requests

8. **BlunderHandler** (88 lines)
   - Handles blunder reversion
   - Returns cards to hand
   - Restores previous game state

### Services Layer

#### `rule.service.refactored.ts`
- **Purpose**: Main orchestrator for game rules
- **Size**: 167 lines (reduced from 655 lines - 75% reduction)
- **Responsibility**: Coordinate validators, handlers, and managers
- **Dependencies**: All rule components

#### Validators (services/validators/)

1. **MoveValidator** (168 lines)
   - Validates if a move is legal
   - Checks turn order
   - Validates card ownership
   - Checks punishment chain requirements
   - Validates multiple card plays
   - Validates single card plays

#### Handlers (services/handlers/)

1. **PunishmentChainManager** (190 lines)
   - Processes punishment chain logic
   - Handles A♠ played
   - Handles 2s on active chain
   - Handles taking punishment
   - Manages deck reshuffling

2. **SpecialEffectsHandler** (119 lines)
   - Applies reverse effects (5, Q)
   - Applies skip effects (7, K)
   - Applies suit change effects (J, 8)
   - Returns events and state changes

3. **CrazyChallengeHandler** (116 lines)
   - Applies illegal turn penalties
   - Handles crazy challenges
   - Manages challenge rewards/penalties

#### Managers (services/managers/)

1. **GameStateManager** (55 lines)
   - Clones game state (immutability)
   - Calculates next player
   - Advances turns
   - Handles skip logic

## Migration Guide

### To Use Refactored Version

1. **Update server.ts**:
```typescript
// Replace
import { SocketController } from './controllers/socket.controller';
// With
import { SocketController } from './controllers/socket.controller.refactored';
```

2. **Update imports**:
```typescript
// Replace
import { RuleService } from './services/rule.service';
// With
import { RuleService } from './services/rule.service.refactored';
```

3. **No other changes required** - All interfaces remain identical

### Benefits

1. **Maintainability**
   - Each file has a single responsibility
   - Easy to locate specific functionality
   - Reduced cognitive load

2. **Testability**
   - Components can be tested in isolation
   - Mock dependencies easily
   - Focused test suites

3. **Scalability**
   - Add new handlers without modifying existing code
   - Extend validators independently
   - Plugin architecture for special effects

4. **Code Reusability**
   - Validators can be reused in different contexts
   - Handlers can be composed
   - Managers provide common utilities

5. **Team Collaboration**
   - Multiple developers can work on different handlers
   - Reduced merge conflicts
   - Clear ownership boundaries

## Component Interactions

### Play Card Flow
```
PlayCardHandler
  → MoveValidator (validate move)
  → RuleService.applyCardEffects
    → GameStateManager (clone state)
    → PunishmentChainManager (process punishment)
    → SpecialEffectsHandler (apply effects)
    → GameStateManager (advance turn)
  → Room update & broadcast
```

### Punishment Flow
```
PunishmentHandler
  → RuleService.takePunishmentCards
    → PunishmentChainManager.takePunishment
      → drawCards (from deck)
      → GameStateManager (advance turn)
  → Room update & broadcast
```

### Crazy Challenge Flow
```
CrazyCallHandler
  → RuleService.applyIllegalTurnPenalty
    → CrazyChallengeHandler.applyIllegalTurnPenalty
      → drawCards (penalty)
  → Broadcast events
```

## Testing Strategy

### Unit Tests
- Test each validator independently
- Test each handler with mocked dependencies
- Test game state manager utilities

### Integration Tests
- Test RuleService coordination
- Test SocketController with mock Socket.IO
- Test complete game flows

### Example Test Structure
```typescript
describe('MoveValidator', () => {
  describe('validateMove', () => {
    it('should reject moves when not player turn');
    it('should allow valid suit matches');
    it('should allow valid rank matches');
    it('should require punishment response when chain active');
  });
});

describe('PlayCardHandler', () => {
  it('should process valid card play');
  it('should detect blunders');
  it('should broadcast game updates');
});
```

## Performance Considerations

1. **Import Time**: Slightly increased due to more files (negligible)
2. **Runtime Performance**: Identical to original (same logic)
3. **Memory**: Minimal increase (additional class definitions)
4. **Bundle Size**: No change for production builds

## Future Enhancements

1. **Add Middleware**: Request validation, rate limiting
2. **Add Logging**: Structured logging per handler
3. **Add Metrics**: Track handler performance
4. **Add Caching**: Cache validation results
5. **Add Plugins**: Extensible special effects system

## Backwards Compatibility

- Original files remain unchanged
- New files use `.refactored.ts` suffix
- Switch by changing imports only
- No breaking changes to APIs
- All events remain identical

## Next Steps

1. Test refactored version in development
2. Run integration tests
3. Perform load testing
4. Switch production gradually
5. Remove original files after validation
