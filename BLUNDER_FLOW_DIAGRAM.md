# Blunder System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PLAYER PLAYS INVALID CARD                       │
│                    (e.g., 5♥ when suit is ♠)                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Backend Validation  │
                   │  RuleService.validate │
                   └──────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ valid = false   │
                    │ canChallenge=true│
                    └─────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Apply Card Effects  │
                   │  (move goes through) │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Emit 'invalid-move' │
                   │  event to all players│
                   └──────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│    BLUNDERER'S VIEW      │      │   OTHER PLAYERS' VIEW    │
│  ┌────────────────────┐  │      │  ┌────────────────────┐  │
│  │  BLUNDER MODAL     │  │      │  │   TOAST MESSAGE    │  │
│  │                    │  │      │  │                    │  │
│  │  ⚠️ Invalid Move!  │  │      │  │  🚨 Player made   │  │
│  │                    │  │      │  │  invalid move!     │  │
│  │  ⏱️ 5 seconds     │  │      │  │                    │  │
│  │  ▓▓▓▓▓▓░░░░       │  │      │  │  Click "Call Crazy"│  │
│  │                    │  │      │  │  to challenge!     │  │
│  │  [Revert Move] ↩️  │  │      │  │                    │  │
│  └────────────────────┘  │      │  └────────────────────┘  │
└──────────────────────────┘      └──────────────────────────┘
            │                                   │
            │                                   │
    ┌───────┴────────┐                  ┌───────┴────────┐
    │                │                  │                │
    ▼                ▼                  ▼                ▼
┌────────┐    ┌────────────┐    ┌────────────┐  ┌──────────┐
│ REVERT │    │ WAIT 5s    │    │ CHALLENGE  │  │ WAIT 8s  │
│ (< 5s) │    │ TIME OUT   │    │ (< 8s)     │  │ NO ACTION│
└────────┘    └────────────┘    └────────────┘  └──────────┘
    │                │                  │                │
    │                │                  │                │
    ▼                ▼                  ▼                ▼
┌────────────────────────────────────────────────────────────┐
│                   OUTCOME RESOLUTION                        │
└────────────────────────────────────────────────────────────┘
    │                │                  │                │
    ▼                ▼                  ▼                ▼


═══════════════════════════════════════════════════════════════
                      OUTCOME 1: REVERT
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  1. Player clicks "Revert Move" button                      │
│  2. Frontend sends 'revert-blunder' event                   │
│  3. Backend:                                                │
│     • Pops cards from pile                                  │
│     • Returns cards to player's hand                        │
│     • Restores previous suit                                │
│     • Player keeps turn                                     │
│  4. Emit 'blunder-reverted' event                           │
│  5. Emit 'game-update' to all players                       │
│  6. Frontend:                                               │
│     • Close modal                                           │
│     • Clear blunder state                                   │
│     • Show success toast                                    │
│  7. Result: Player can play again ✅                         │
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                   OUTCOME 2: CHALLENGED
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  1. Other player clicks "Call Crazy"                        │
│  2. Frontend sends 'call-crazy' event                       │
│  3. Backend:                                                │
│     • Apply penalty (2 cards)                               │
│     • Advance turn                                          │
│     • Move stays in place                                   │
│  4. Emit 'crazy-called' event                               │
│  5. Emit 'game-update' to all players                       │
│  6. Frontend:                                               │
│     • Close modal                                           │
│     • Clear blunder state                                   │
│     • Show challenge toast                                  │
│  7. Result: Blunderer punished, game continues ❌           │
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                   OUTCOME 3: NO ACTION
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  1. Timer expires (8 seconds total)                         │
│  2. No revert, no challenge                                 │
│  3. Frontend:                                               │
│     • Auto-close modal                                      │
│     • Clear blunder state                                   │
│  4. Backend:                                                │
│     • Move remains valid                                    │
│     • Game state unchanged                                  │
│  5. Result: Move stands, next player's turn ✅              │
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                      TIMING BREAKDOWN
═══════════════════════════════════════════════════════════════

│ 0s ─────────────────────────────────────────────────── 8s │
│                                                             │
│ ┌──────── REVERT WINDOW ────────┐                         │
│ │                                │                         │
│ │   Blunder Modal Visible        │   Challenge Window     │
│ │   Player can revert            │   Others can challenge │
│ │                                │   Modal auto-closed    │
│ │                                │                         │
│ 0s ────────────────────────── 5s ────────────────────── 8s │
│                                                             │
│ ← Player's Action Window →  ← Opponents' Action Window → │

Key Timing:
• 0-5s:  Blunderer can revert (modal shown)
• 0-8s:  Opponents can challenge (toast shown)
• 5-8s:  Modal closes, challenge window remains
• >8s:   All windows close, move stands


═══════════════════════════════════════════════════════════════
                      STATE MANAGEMENT
═══════════════════════════════════════════════════════════════

Frontend Store State:
┌─────────────────────────────────────────────────────────────┐
│  blunderActive: boolean      → Is blunder window open?      │
│  blunderReason: string       → Why was move invalid?        │
│  blunderPlayerId: string     → Who made the blunder?        │
│  blunderCards: Card[]        → Which cards were played?     │
│  blunderTimeLeft: number     → Countdown timer value        │
└─────────────────────────────────────────────────────────────┘

State Transitions:
┌─────────────────────────────────────────────────────────────┐
│  IDLE → BLUNDER_ACTIVE → (REVERTED | CHALLENGED | TIMEOUT) │
│                                    ↓                         │
│                                  IDLE                        │
└─────────────────────────────────────────────────────────────┘

Event Flow:
┌─────────────────────────────────────────────────────────────┐
│  Backend                          Frontend                   │
│  ────────                          ────────                  │
│                                                              │
│  validateMove() ───────────────────→ invalid-move event     │
│                                      Set blunderActive=true  │
│                                      Show modal/toast        │
│                                                              │
│  revert-blunder ←──────────────── Click "Revert" button    │
│  Pop cards from pile                                        │
│  Return to hand                                             │
│  blunder-reverted ─────────────→  Clear blunder state      │
│                                      Show success toast      │
│                                                              │
│  call-crazy ←─────────────────── Click "Call Crazy" button │
│  Apply penalty                                              │
│  crazy-called ──────────────────→ Clear blunder state      │
│                                      Show challenge toast    │
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                    COMPONENT HIERARCHY
═══════════════════════════════════════════════════════════════

GamePage
│
├─── CardHand
│    └─── Card (with selection state)
│
├─── Control Buttons
│    ├─── Play
│    ├─── Take
│    └─── Call Crazy (highlighted during blunder)
│
├─── SuitSelectionModal
│
├─── BlunderModal ⭐ NEW
│    ├─── Warning Icon (animated)
│    ├─── Countdown Timer
│    ├─── Progress Bar
│    ├─── Warning Text
│    └─── Revert Button
│
└─── GameOverModal

ConnectionManager (global)
└─── Connection Indicator


═══════════════════════════════════════════════════════════════
                     NETWORK MESSAGES
═══════════════════════════════════════════════════════════════

Client → Server:
┌─────────────────────────────────────────────────────────────┐
│  revert-blunder                                             │
│  {                                                          │
│    roomId: string                                           │
│    cards: Card[]  // Cards to remove from pile              │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

Server → Clients:
┌─────────────────────────────────────────────────────────────┐
│  invalid-move (game-event)                                  │
│  {                                                          │
│    type: 'invalid-move'                                     │
│    payload: {                                               │
│      playerId: string                                       │
│      reason: string                                         │
│      canBeChallenged: boolean                               │
│      cards: Card[]        // NEW: Cards played              │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  blunder-reverted (game-event)                              │
│  {                                                          │
│    type: 'blunder-reverted'                                 │
│    payload: {                                               │
│      playerId: string                                       │
│      message: string                                        │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```
