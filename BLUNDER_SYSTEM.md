# Blunder Detection & Challenge System

## Overview
Implemented a comprehensive blunder detection system that allows players to make mistakes, but gives them a chance to revert before being challenged by other players.

## Features

### 1. **Blunder Detection**
- Backend validates all moves but allows invalid moves (blunders) to go through
- Invalid moves are marked with `canBeChallenged: true`
- Cards are played but can be reverted

### 2. **Player Who Blundered**
- **Blunder Modal** appears immediately when invalid move detected
- Shows countdown timer (5 seconds to revert)
- Displays warning about potential "Crazy" calls
- Prominent "Revert Move" button
- Visual indicators: red theme, warning icons, progress bar

### 3. **Other Players**
- Receive toast notification: "🚨 [Player] made an invalid move! Click Call Crazy to challenge!"
- Have 8 seconds total to challenge
- Can click "Call Crazy" button to challenge
- Toast has red border for emphasis

### 4. **Challenge Outcomes**

**If Player Reverts in Time:**
- Move is undone
- Cards returned to player's hand
- Previous game state restored
- Player keeps their turn
- All players notified: "[Player] reverted their move"
- Blunder state cleared

**If Player Doesn't Revert & Someone Challenges:**
- Challenger calls "Crazy"
- Blunderer receives 2 punishment cards
- Game continues from challenged state
- Standard crazy-call event fires

**If Nobody Challenges:**
- Move stands as valid
- Blunder state clears after 8 seconds
- Game continues normally

## Technical Implementation

### Frontend Components

#### BlunderModal (`frontend/components/BlunderModal.tsx`)
```typescript
- Countdown timer (5 seconds)
- Visual progress bar
- Warning messages
- Revert button
- Auto-closes when time expires
```

#### Store Updates (`frontend/lib/store.ts`)
```typescript
// New State
- blunderActive: boolean
- blunderReason: string | null
- blunderPlayerId: string | null
- blunderCards: Card[]
- blunderTimeLeft: number

// New Action
- revertBlunder(): Promise<result>

// Event Handlers
- 'invalid-move': Shows modal or toast
- 'blunder-reverted': Clears state, shows success
```

### Backend Handlers

#### Socket Events (`backend/src/controllers/socket.controller.ts`)

**revert-blunder:**
```typescript
- Pops cards from pile
- Returns cards to player's hand
- Restores previous suit
- Keeps player's turn
- Broadcasts 'blunder-reverted' event
- Updates all players with new state
```

**Enhanced play-card:**
```typescript
- Includes cards in invalid-move event payload
- Allows blunders to be played
- Marks with canBeChallenged flag
```

### Type Definitions

**GameEvent** (`backend/src/types/game.types.ts`)
```typescript
| { type: 'invalid-move'; 
    payload: { 
      playerId: string; 
      reason: string; 
      canBeChallenged: boolean; 
      cards?: Card[] 
    } 
  }
| { type: 'blunder-reverted'; 
    payload: { 
      playerId: string; 
      message: string 
    } 
  }
```

## User Experience Flow

### Scenario 1: Player Reverts Quickly
```
1. Player plays wrong card (e.g., 5♥ when suit is ♠)
2. ⚡ Blunder Modal appears for player
3. ⏱️ Timer shows 5 seconds
4. 🔔 Other players get challenge toast
5. ✅ Player clicks "Revert Move"
6. 🔄 Cards returned to hand
7. 🎮 Player can play again
8. 📢 All notified: "Player reverted their move"
```

### Scenario 2: Player is Challenged
```
1. Player plays wrong card
2. ⚡ Blunder Modal appears
3. 🔔 Other players get challenge toast
4. 🚨 Opponent clicks "Call Crazy"
5. ❌ Modal closes
6. 📥 Blunderer gets 2 cards
7. 🔄 Turn advances
8. 📢 "Opponent called CRAZY on Player!"
```

### Scenario 3: No Challenge Occurs
```
1. Player plays wrong card
2. ⚡ Blunder Modal appears
3. ⏱️ 5 seconds pass (modal closes)
4. 🔔 Other players notified but don't challenge
5. ⏱️ 3 more seconds pass (total 8s)
6. ✅ Move stands as valid
7. 🎮 Game continues normally
```

## Configuration

### Timing Constants
```typescript
// In store.ts invalid-move handler
blunderTimeLeft: 5,  // Time to revert (player's window)

// Challenge window
setTimeout(() => {}, 3000);  // Extra 3s after revert window

// Total challenge time: 8 seconds
setTimeout(() => {}, 8000);  // For other players
```

### Penalties
```typescript
// From rule.service.ts
illegalTurnPenalty: 2  // Cards given on challenge
```

## Visual Indicators

### Blunder Modal
- 🔴 Red gradient background
- ⚠️ Animated warning icon
- ⏱️ Yellow countdown timer
- 📊 Progress bar (yellow → red)
- ↩️ Prominent revert button
- 💡 Warning text about challenges

### Toast Notifications
- 🚨 Red border for challenge opportunity
- ✅ Green for successful revert
- ⚠️ Yellow for crazy calls
- ℹ️ Info for general events

## Benefits

### For Players
✅ **Forgiving**: Can correct mistakes quickly
✅ **Fair**: Others can still challenge if too slow
✅ **Transparent**: Clear visual feedback
✅ **Engaging**: Adds tension and strategy
✅ **Competitive**: Rewards quick reactions

### For Gameplay
✅ **Strategic**: Opponents must decide to challenge
✅ **Time-Pressure**: Creates exciting moments
✅ **Balanced**: 5s to revert, 8s to challenge
✅ **Clear Rules**: Everyone knows the windows
✅ **Fun Factor**: Adds drama without being punishing

## Testing Checklist

- [ ] Play invalid card (wrong suit/rank)
- [ ] Verify modal appears for blunderer
- [ ] Verify toast appears for others
- [ ] Test revert within 5 seconds
- [ ] Test revert after 5 seconds (should fail)
- [ ] Test challenge from another player
- [ ] Test no challenge scenario
- [ ] Verify cards returned correctly on revert
- [ ] Verify game state updates properly
- [ ] Test with multiple invalid moves
- [ ] Test with punishment chain active
- [ ] Verify all players see correct notifications

## Future Enhancements

Potential improvements:
- [ ] Sound effects for blunder detection
- [ ] Vibration on mobile for blunders
- [ ] Statistics tracking (blunders per game)
- [ ] Configurable timer durations
- [ ] Auto-challenge bot for single player
- [ ] Replay of blundered moves
- [ ] Achievement: "Quick Reflexes" (revert < 2s)

---

**Status:** ✅ Complete - Ready for testing
**Files Modified:** 5 frontend, 2 backend, 1 new component
**Date:** November 30, 2025
