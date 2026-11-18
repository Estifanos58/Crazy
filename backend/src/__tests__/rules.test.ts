import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleService } from '../services/rule.service';
import { CardService } from '../services/card.service';
import { RuleBuilder, RuleValidator } from '../utils/rule-builder';
import type { Card, GameState, ServerPlayer } from '../types/game.types';

function createPlayer(id: string, username: string, cards: Card[] = []): ServerPlayer {
  return {
    id,
    token: `token_${id}`,
    username,
    avatar: '🦊',
    cards,
    isCreator: id === 'p1',
    connected: true,
  };
}

function createBaseGameState(players: ServerPlayer[], topCard?: Card): GameState {
  const pile: Card[] = topCard ? [topCard] : [];
  return {
    roomId: 'test-room-1',
    players,
    deck: CardService.createDeck(),
    pile,
    currentTurn: players[0].id,
    currentSuit: topCard ? topCard.suit : 'hearts',
    turnDirection: 'clockwise',
    punishmentChain: { active: false, amount: 0, cards: [] },
    ruleConfig: RuleService.getDefaultConfig(),
    gameStarted: true,
    gameEnded: false,
  };
}

describe('Authoritative Card Game Rules & Move Validation', () => {
  it('validates single card matching suit', () => {
    const cardInHand: Card = { id: '10-hearts', rank: '10', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [cardInHand]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [cardInHand]);

    assert.equal(result.valid, true);
    assert.equal(result.canChallengeCrazy, false);
  });

  it('validates single card matching rank', () => {
    const cardInHand: Card = { id: '5-spades', rank: '5', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [cardInHand]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [cardInHand]);

    assert.equal(result.valid, true);
    assert.equal(result.canChallengeCrazy, false);
  });

  it('allows suit-change cards (J and 8) to be played on any suit/rank', () => {
    const jackCard: Card = { id: 'J-clubs', rank: 'J', suit: 'clubs' };
    const eightCard: Card = { id: '8-diamonds', rank: '8', suit: 'diamonds' };
    const p1 = createPlayer('p1', 'Alice', [jackCard, eightCard]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);

    assert.equal(RuleService.validateMove(state, 'p1', [jackCard]).valid, true);
    assert.equal(RuleService.validateMove(state, 'p1', [eightCard]).valid, true);
  });

  it('flags non-matching cards as a blunder (canChallengeCrazy = true)', () => {
    const wrongCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [wrongCard]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [wrongCard]);

    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, true);
  });

  it('enforces drop card (7) requirement for playing multiple cards', () => {
    const card7: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const card9: Card = { id: '9-hearts', rank: '9', suit: 'hearts' };
    const card10: Card = { id: '10-hearts', rank: '10', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card7, card9, card10]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);

    assert.equal(RuleService.validateMove(state, 'p1', [card7, card9]).valid, true);

    const invalidResult = RuleService.validateMove(state, 'p1', [card9, card10]);
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.canChallengeCrazy, true);
  });

  it('rejects multiple cards with mismatched suits as a blunder', () => {
    const card7Hearts: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const card9Spades: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [card7Hearts, card9Spades]);
    const p2 = createPlayer('p2', 'Bob', [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [card7Hearts, card9Spades]);

    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, true);
  });
});

describe('Special Card Effects, Two-Player Reverse & Turn Advancement', () => {
  it('applies reverse card (5) in 3-player game and moves to previous player', () => {
    const card5: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card5, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [card5]);

    assert.equal(updatedState.turnDirection, 'counterclockwise');
    assert.equal(updatedState.currentTurn, 'p3');
    assert.ok(events.some((e) => e.type === 'turn-reversed'));
  });

  it('treats reverse card (5) in 2-player game as a skip so acting player plays again', () => {
    const card5: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card5, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [card5]);

    assert.equal(updatedState.turnDirection, 'counterclockwise');
    assert.equal(updatedState.currentTurn, 'p1'); // Acts as skip in 2-player!
    assert.ok(events.some((e) => e.type === 'turn-reversed'));
    assert.ok(events.some((e) => e.type === 'player-skipped' && e.payload.playerId === 'p2'));
  });

  it('applies skip card (7) effect skipping next player and landing on third player', () => {
    const card7: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card7, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [card7]);

    assert.equal(updatedState.currentTurn, 'p3');
    assert.ok(events.some((e) => e.type === 'player-skipped' && e.payload.playerId === 'p2'));
  });

  it('does NOT skip next player when current player finishes on a normal card', () => {
    const lastCard: Card = { id: '9-hearts', rank: '9', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [lastCard]); // Finishing on this play
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState } = RuleService.applyCardEffects(state, 'p1', [lastCard]);

    // Turn MUST advance to Bob (p2), NOT skip to Charlie (p3)!
    assert.equal(updatedState.currentTurn, 'p2');
    assert.equal(updatedState.gameEnded, false);
  });

  it('advances turn accurately when a player finishes on a Skip (7) card', () => {
    const lastSkip: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [lastSkip]); // Finishing on Skip
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState } = RuleService.applyCardEffects(state, 'p1', [lastSkip]);

    // Bob is skipped, turn MUST land on Charlie (p3)
    assert.equal(updatedState.currentTurn, 'p3');
  });

  it('advances turn accurately when a player finishes on a Reverse (5) card', () => {
    const lastReverse: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [lastReverse]); // Finishing on Reverse
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState } = RuleService.applyCardEffects(state, 'p1', [lastReverse]);

    // Direction reverses to counterclockwise, next active from Alice is Charlie (p3)
    assert.equal(updatedState.turnDirection, 'counterclockwise');
    assert.equal(updatedState.currentTurn, 'p3');
  });

  it('respects suit constraints on CardSelector for special cards', () => {
    const customConfig = RuleService.mergeConfig(
      new RuleBuilder()
        .setReverseCard('5', 'spades') // ONLY 5 of spades reverses!
        .setSkipCard('7', 'hearts') // ONLY 7 of hearts skips!
        .setSuitChangeCards([{ rank: 'J', suit: 'clubs' }]) // ONLY J of clubs changes suit!
        .build()
    );

    const fiveHearts: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
    const sevenClubs: Card = { id: '7-clubs', rank: '7', suit: 'clubs' };
    const jackDiamonds: Card = { id: 'J-diamonds', rank: 'J', suit: 'diamonds' };

    const p1 = createPlayer('p1', 'Alice', [
      fiveHearts,
      sevenClubs,
      jackDiamonds,
      { id: 'd1', rank: '10', suit: 'hearts' },
    ]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'clubs' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'spades' }]);

    const state = createBaseGameState([p1, p2, p3], { id: '3-hearts', rank: '3', suit: 'hearts' });
    state.ruleConfig = customConfig;

    // 5♥ should NOT reverse since only 5♠ is configured
    const res1 = RuleService.applyCardEffects(state, 'p1', [fiveHearts]);
    assert.equal(res1.updatedState.turnDirection, 'clockwise');
    assert.equal(res1.updatedState.currentTurn, 'p2');

    // J♦ should NOT be treated as wild suit-change card since only J♣ is configured
    const valJack = RuleService.validateMove(state, 'p1', [jackDiamonds]);
    assert.equal(valJack.valid, false);
  });

  it('prevents consecutive suit changes by the immediate next player', () => {
    const cardJ1: Card = { id: 'J-hearts', rank: 'J', suit: 'hearts' };
    const cardJ2: Card = { id: 'J-spades', rank: 'J', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [cardJ1, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [cardJ2, { id: 'd2', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const { updatedState: stateAfterP1 } = RuleService.applyCardEffects(
      state,
      'p1',
      [cardJ1],
      'clubs'
    );

    assert.equal(stateAfterP1.currentSuit, 'clubs');
    assert.equal(stateAfterP1.lastSuitChangedBy, 'p1');

    const { updatedState: stateAfterP2 } = RuleService.applyCardEffects(
      stateAfterP1,
      'p2',
      [cardJ2],
      'diamonds'
    );

    assert.equal(stateAfterP2.currentSuit, 'spades');
  });
});

describe('Punishment Chain Mechanics & Accurate Card Drawing Counts', () => {
  it('starts punishment chain with A♠ (5 penalty cards) and stacks 2♠ to 7', () => {
    const aceSpades: Card = { id: 'A-spades', rank: 'A', suit: 'spades' };
    const twoSpades: Card = { id: '2-spades', rank: '2', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [aceSpades, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [twoSpades, { id: 'd2', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };

    const state = createBaseGameState([p1, p2], topCard);
    const { updatedState: state1 } = RuleService.applyCardEffects(state, 'p1', [aceSpades]);
    assert.equal(state1.punishmentChain.active, true);
    assert.equal(state1.punishmentChain.amount, 5);

    const { updatedState: state2, events } = RuleService.applyCardEffects(state1, 'p2', [twoSpades]);
    assert.equal(state2.punishmentChain.amount, 7);
    assert.ok(events.some((e) => e.type === 'punishment-chain-increased'));
  });

  it('reports ACTUAL drawn card count when deck and pile cannot satisfy full punishment', () => {
    const p1 = createPlayer('p1', 'Alice', []);
    const p2 = createPlayer('p2', 'Bob', [{ id: '9-clubs', rank: '9', suit: 'clubs' }]);
    const state = createBaseGameState([p1, p2], { id: 'A-spades', rank: 'A', suit: 'spades' });
    // Only 2 cards exist in deck and 1 top card in pile -> only 2 cards can be drawn for a +5 penalty
    state.deck = [
      { id: '3-hearts', rank: '3', suit: 'hearts' },
      { id: '4-hearts', rank: '4', suit: 'hearts' },
    ];
    state.punishmentChain = {
      active: true,
      amount: 5,
      cards: [{ id: 'A-spades', rank: 'A', suit: 'spades' }],
    };

    const { updatedState, events } = RuleService.takePunishmentCardsNoAdvance(state, 'p1');
    const p1After = updatedState.players.find((p) => p.id === 'p1');
    assert.equal(p1After?.cards.length, 2);

    const drawnEvent = events.find((e) => e.type === 'cards_drawn');
    assert.ok(drawnEvent && drawnEvent.type === 'cards_drawn');
    assert.equal(drawnEvent.amount, 2);

    const takenEvent = events.find((e) => e.type === 'punishment-taken');
    assert.ok(takenEvent && takenEvent.type === 'punishment-taken');
    assert.equal(takenEvent.payload.amount, 2);
  });

  it('shuffles deck securely while preserving all 52 unique cards', () => {
    const deck = CardService.createDeck();
    const shuffled = CardService.shuffleDeck(deck);

    assert.equal(shuffled.length, 52);
    assert.equal(new Set(shuffled.map((c) => c.id)).size, 52);
    // Original deck must not be mutated
    assert.equal(deck[0].id, 'A-hearts');
  });

  it('validates custom rules strictly with runtime schema', () => {
    assert.equal(RuleValidator.validate({ illegalTurnPenalty: 3 }).valid, true);
    assert.equal(RuleValidator.validate({ illegalTurnPenalty: -1 }).valid, false);
    assert.equal(RuleValidator.validate({ illegalTurnPenalty: 999 }).valid, false);
    assert.equal(
      RuleValidator.validate({
        punishment: { aceSpadePenalty: -5 },
      }).valid,
      false
    );
    assert.equal(
      RuleValidator.validate({
        unknownField: true,
      }).valid,
      false
    );
  });
});
