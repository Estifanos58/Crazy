# Crazy — Game Rules & Presets

## Core Objective

Be the first player to empty your hand. Matches support **2 to 8 players**. Each player is dealt the configured starting hand size (default 7 cards), with the starting player dealt 1 extra card to open the match.

## Turn Flow

1. **Match Suit or Rank**: Play a card matching either the active suit or the rank of the top discard card.
2. **Draw or Pass**: If you cannot (or prefer not to) play, draw 1 card. Your turn remains active so you may play the drawn card immediately, or choose **Pass Turn** to advance play.
3. **Finishing & Standings**: Players who empty their hands receive their rank (1st, 2nd, 3rd…) while remaining active players finish out the match.

## Special Action Cards (Standard Preset)

| Card | Effect |
| :--- | :--- |
| **A♠** | Starts or increases a punishment chain by **+5 cards**. Counter only with **2♠**. |
| **Any 2** | Starts or increases a punishment chain by **+2 cards**. Counter with a matching-suit 2 (or A♠ on 2♠). Taking penalty cards clears the chain and keeps your turn active. |
| **5** | **Reverse**: Reverses turn direction (clockwise ↔ counter-clockwise). In a **2-player** game, acts as a Skip so you go again immediately. |
| **7** | **Skip & Multi-Drop**: Played alone, skips the next active player. Include a 7 to drop multiple cards of the same matching suit in one turn (skip/reverse do not trigger on multi-card drops). |
| **J & 8** | **Wild Suit Change**: Play on any non-punishment turn to declare a new active suit. Consecutive suit changes by the immediate next player are blocked (card falls back to its natural suit). |

## Blunders & Calling "Crazy"

Playing a card that violates the current matching, punishment, or multi-drop rules enters a server-managed **Blunder Window** (cards are held in server escrow to prevent duplication):

- **0–5 seconds**: The blunderer may **Revert Move** to take back their cards without penalty.
- **0–8 seconds**: Any active opponent may **Call Crazy** to penalize the blunderer (+2 cards in Standard mode; cards returned and turn stays with the blunderer).
- **After 8 seconds**: An authoritative server timer automatically resolves the blunder, returns the cards, applies the penalty, and advances the turn.

## Rule Presets

- **Standard**: A♠ (+5), 2s (+2), 5 Reverse, 7 Skip/Multi-Drop, J & 8 Wild, Blunder penalty +2.
- **Beginner**: Lighter penalties (A♠ +3, 2s +1, Blunder +1).
- **Hardcore**: Heavier penalties (A♠ +7, 2s +3, Blunder +3).
- **Chaos**: Adds Queens to Reverse, Kings to Skip, and all Aces to Suit Change.
- **Classic**: Pure suit and rank matching with no punishments, wildcards, or multi-drops.
