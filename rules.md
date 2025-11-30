# 🎮 Crazy Multiplayer Card Game – Rule Service Generator

You are Claude, an AI engineer who must generate an extensible **RuleService** for the Crazy card game.  
Follow the instructions strictly.

---

# 📌 GOAL

Build a full **RuleService** (TypeScript) that:

1. Contains **all default game rules** listed below.
2. Supports **dynamic rule configuration** by room creator.
3. Allows users to **edit rule parameters** (e.g., "how many cards does A♠ give", "what rank reverses", etc.).
4. Integrates cleanly with our existing `CardService`.
5. Produces reusable rule handlers for:
   - turn validation  
   - punishment cards  
   - suit-changing cards  
   - illegal-move detection  
   - combo chains (2-chain, A♠ + 2-spade chain)  
   - reverse logic  
   - skip logic  
   - crazy challenge logic  

The final code must be:

- **Modular**
- **Extendable**
- **Backend-friendly**
- **Stateless functions with clean inputs/outputs**
- **Socket-safe JSON objects**

---

# 📌 EXISTING CARD SERVICE

Use the following card definitions:

- Suit: `"hearts" | "diamonds" | "clubs" | "spades"`
- Rank: `"A" | "2" | ... | "10" | "J" | "Q" | "K"`

Deck created from:

```ts
id: `${rank}-${suit}`
Use this structure inside rules.

📌 DEFAULT RULES (YOU MUST IMPLEMENT ALL)
🂡 1. A♠ Punishment Rule
A♠ played → next player must take 5 cards

If next player plays 2♠, punishment becomes 5 + 2 = 7

If the following player plays any 2, punishment grows:

e.g., 7 + 2 = 9

When someone cannot continue chain:

Show buttons:

Take N cards

Play a 2 (if they have it)

🂢 2. Normal Rank-2 Punishment Rule
A 2 (any suit) → next player must take 2 cards

Next player options:

Take 2

Play any 2

If they play another 2 → punishment stacks

2 → 4 → 6 → 8 etc.

If player clicks "put 2" but plays ANYTHING else:

Give 2 cards automatically

🌀 3. Illegal Turn Rule ("Crazy" Call)
If a player plays when it is NOT their turn:

Broadcast: "Crazy <username>!"

Force player to draw 2 cards

🔄 4. Reverse Rule (5 of any suit)
Playing rank 5 reverses turn direction

⏭ 5. Skip Rule (7 of any suit)
Two cases:

If rank 7 is played alone → next player is skipped

If rank 7 is played with “drop all same suits”:

Player may drop ALL cards of the same suit in a single move

🎭 6. Suit Change Rule (J or 8)
Player can set the next active suit manually

Next player must follow suit

Cannot change suit AGAIN unless same rank (J or 8)

😵 7. Crazy Challenge Rule (wrong suit)
If player drops a card with a different suit:

Other players see "Crazy" button

If someone else clicks first:

Player receives 2 cards

If the current player clicks first:

The card returns to their hand

They play again

🏆 8. Win Condition Rule
First player to finish cards wins

Game continues until only one player has cards

📌 RULE SERVICE REQUIREMENTS
Claude must build a complete RuleService that includes:

1. RuleConfig object
Default rules + editable fields:

Example:

ts
Copy code
interface RuleConfig {
  punishment: {
    A_spades_amount: number;  // default 5
    rank2_amount: number;     // default 2
  };
  specialCards: {
    reverseRank: '5';
    skipRank: '7';
    suitChangeRanks: ['J', '8'];
  };
  crazyPenalty: number; // default 2
  allowDropAllSameSuit: boolean; // default true
}
2. Rule Engine Functions
Generate functions such as:

ts
Copy code
applyPunishmentRule(gameState, playedCard)
validateTurn(gameState, playerId)
applyReverseIfNeeded(gameState, playedCard)
applySkipIfNeeded(gameState, playedCard)
applySuitChangeIfNeeded(gameState, playedCard, chosenSuit)
handleCrazyChallenge(gameState, playedCard, clicks)
validatePlay(gameState, playerId, playedCard)
3. Chainable Punishment Engine
Support A♠ → 2♠ → 2♦ → 2♥ etc.

4. All functions return clean outputs
Example:

ts
Copy code
{
  updatedState,
  events: [
    { type: 'punishment', amount: 7, target: 'player2' },
    { type: 'reverse' },
  ]
}
5. Exported RuleService
One class with static methods:

ts
Copy code
export class RuleService {
  static applyRules(gameState, action) { ... }
  static validateMove(gameState, action) { ... }
  static resolvePunishmentChain(...) { ... }
  static evaluateCardEffects(...) { ... }
}
6. No side effects
Do NOT mutate incoming objects directly—always clone state.

📌 CLAUDE — YOUR TASK
Generate:

Full RuleService.ts

RuleConfig interface & defaults

All helper utilities

Complete punishment-chain logic

All special-card handlers

All crazy-button mechanics

Comments explaining each rule

Final export ready to use in Express backend

The result must be production-ready.