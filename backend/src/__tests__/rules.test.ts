import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RuleService } from '../services/rule.service';
import { CardService } from '../services/card.service';
import type { Card, GameState, ServerPlayer } from '../types/game.types';

function createPlayer(id: string, username: string, cards: Card[] = []): ServerPlayer {
  return {
    id,
    token: `token_${id}`,
    username,
    avatar: '🤖',
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
    const p2 = createPlayer('p2', 'Bob', []);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [cardInHand]);

    assert.equal(result.valid, true);
    assert.equal(result.canChallengeCrazy, false);
  });

  it('validates single card matching rank', () => {
    const cardInHand: Card = { id: '5-spades', rank: '5', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [cardInHand]);
    const p2 = createPlayer('p2', 'Bob', []);
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
    const p2 = createPlayer('p2', 'Bob', []);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);

    const jackResult = RuleService.validateMove(state, 'p1', [jackCard]);
    assert.equal(jackResult.valid, true);

    const eightResult = RuleService.validateMove(state, 'p1', [eightCard]);
    assert.equal(eightResult.valid, true);
  });

  it('flags non-matching cards as a blunder (canChallengeCrazy = true)', () => {
    const wrongCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [wrongCard]);
    const p2 = createPlayer('p2', 'Bob', []);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [wrongCard]);

    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, true);
  });

  it('enforces drop card (7) requirement for playing multiple cards', () => {
    const card7: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const card9: Card = { id: '9-hearts', rank: '9', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card7, card9]);
    const p2 = createPlayer('p2', 'Bob', []);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);

    // Valid multiple cards with 7 of matching suit
    const validResult = RuleService.validateMove(state, 'p1', [card7, card9]);
    assert.equal(validResult.valid, true);

    // Invalid multiple cards without 7
    const card10: Card = { id: '10-hearts', rank: '10', suit: 'hearts' };
    p1.cards.push(card10);
    const invalidResult = RuleService.validateMove(state, 'p1', [card9, card10]);
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.canChallengeCrazy, true);
  });

  it('rejects multiple cards with mismatched suits as a blunder', () => {
    const card7Hearts: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const card9Spades: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [card7Hearts, card9Spades]);
    const p2 = createPlayer('p2', 'Bob', []);
    const topCard: Card = { id: '4-hearts', rank: '4', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    const result = RuleService.validateMove(state, 'p1', [card7Hearts, card9Spades]);

    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, true);
  });
});

describe('Special Card Effects', () => {
  it('applies reverse card (5) effect and changes direction to previous player', () => {
    const card5: Card = { id: '5-hearts', rank: '5', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card5, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'hearts' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [card5]);

    assert.equal(updatedState.turnDirection, 'counterclockwise');
    // Previous player in clockwise from p1 was p3
    assert.equal(updatedState.currentTurn, 'p3');
    assert.ok(events.some(e => e.type === 'turn-reversed'));
  });

  it('applies skip card (7) effect skipping next player and landing on third player', () => {
    const card7: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', [card7, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'hearts' }]);
    const p3 = createPlayer('p3', 'Charlie', [{ id: 'd3', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2, p3], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [card7]);

    // Next player p2 skipped, lands on p3
    assert.equal(updatedState.currentTurn, 'p3');
    assert.ok(events.some(e => e.type === 'player-skipped'));
  });

  it('prevents consecutive suit changes by the immediate next player', () => {
    const cardJ1: Card = { id: 'J-hearts', rank: 'J', suit: 'hearts' };
    const cardJ2: Card = { id: 'J-spades', rank: 'J', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [cardJ1, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [cardJ2, { id: 'd2', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '3-hearts', rank: '3', suit: 'hearts' };

    const state = createBaseGameState([p1, p2], topCard);
    // Player 1 changes suit to clubs
    const { updatedState: stateAfterP1 } = RuleService.applyCardEffects(
      state,
      'p1',
      [cardJ1],
      'clubs'
    );

    assert.equal(stateAfterP1.currentSuit, 'clubs');
    assert.equal(stateAfterP1.lastSuitChangedBy, 'p1');

    // Player 2 plays J-spades and attempts to change suit to diamonds
    const { updatedState: stateAfterP2 } = RuleService.applyCardEffects(
      stateAfterP1,
      'p2',
      [cardJ2],
      'diamonds'
    );

    // Consecutive suit change blocked: uses natural card suit (spades), not chosen suit (diamonds)
    assert.equal(stateAfterP2.currentSuit, 'spades');
  });
});

describe('Punishment Chain Mechanics', () => {
  it('starts punishment chain with A♠ (5 penalty cards)', () => {
    const aceSpades: Card = { id: 'A-spades', rank: 'A', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [aceSpades, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [{ id: 'd2', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };

    const state = createBaseGameState([p1, p2], topCard);
    const { updatedState, events } = RuleService.applyCardEffects(state, 'p1', [aceSpades]);

    assert.equal(updatedState.punishmentChain.active, true);
    assert.equal(updatedState.punishmentChain.amount, 5);
    assert.ok(events.some(e => e.type === 'punishment-chain-started'));
  });

  it('stacks 2s on an active punishment chain', () => {
    const aceSpades: Card = { id: 'A-spades', rank: 'A', suit: 'spades' };
    const twoSpades: Card = { id: '2-spades', rank: '2', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', [aceSpades, { id: 'd1', rank: '10', suit: 'hearts' }]);
    const p2 = createPlayer('p2', 'Bob', [twoSpades, { id: 'd2', rank: '10', suit: 'hearts' }]);
    const topCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };

    const state = createBaseGameState([p1, p2], topCard);
    const { updatedState: state1 } = RuleService.applyCardEffects(state, 'p1', [aceSpades]);
    assert.equal(state1.punishmentChain.amount, 5);

    // Bob plays 2♠ responding to A♠
    const { updatedState: state2, events } = RuleService.applyCardEffects(state1, 'p2', [twoSpades]);
    assert.equal(state2.punishmentChain.active, true);
    assert.equal(state2.punishmentChain.amount, 7); // 5 + 2
    assert.ok(events.some(e => e.type === 'punishment-chain-increased'));
  });

  it('allows taking punishment cards without advancing turn', () => {
    const p1 = createPlayer('p1', 'Alice', []);
    const p2 = createPlayer('p2', 'Bob', []);
    const state = createBaseGameState([p1, p2]);
    state.punishmentChain = {
      active: true,
      amount: 4,
      cards: [{ id: '2-hearts', rank: '2', suit: 'hearts' }],
    };

    const { updatedState, events } = RuleService.takePunishmentCardsNoAdvance(state, 'p1');

    const p1After = updatedState.players.find(p => p.id === 'p1');
    assert.equal(p1After?.cards.length, 4);
    assert.equal(updatedState.punishmentChain.active, false);
    assert.equal(updatedState.punishmentChain.amount, 0);
    assert.equal(updatedState.currentTurn, 'p1'); // Turn stays!
    assert.ok(events.some(e => e.type === 'punishment-taken'));
  });
});
