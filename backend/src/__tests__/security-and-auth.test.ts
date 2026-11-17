import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleService } from '../services/rule.service';
import { GameOrchestrator } from '../services/game.orchestrator';
import { RoomService } from '../services/room.service';
import type { Card, GameState, ServerPlayer, GameRoom } from '../types/game.types';

function createPlayer(id: string, username: string, isCreator = false, cards: Card[] = []): ServerPlayer {
  return {
    id,
    token: `secret_token_${id}`,
    username,
    avatar: '🦊',
    cards,
    isCreator,
    connected: true,
  };
}

describe('Security & Authorization Controls', () => {
  it('strictly rejects out-of-turn card play without triggering a blunder', () => {
    const card: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', true, [card]);
    const p2 = createPlayer('p2', 'Bob', false, [card]);

    const state: GameState = {
      roomId: 'room-auth-1',
      players: [p1, p2],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1', // Alice's turn
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    // Bob tries to play on Alice's turn
    const result = RuleService.validateMove(state, 'p2', [card]);
    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, false); // Crucial: out of turn must NEVER be a challengeable blunder!
    assert.equal(result.errors?.[0], 'Not your turn');
  });

  it('rejects duplicate card IDs within the same play attempt', () => {
    const card: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', true, [card]); // Has only 1 card

    const state: GameState = {
      roomId: 'room-auth-2',
      players: [p1],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    // Client maliciously sends [card, card]
    const result = RuleService.validateMove(state, 'p1', [card, card]);
    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, false);
    assert.equal(result.errors?.[0], 'Duplicate card played');
  });

  it('rejects cards not present in the player authoritative server hand', () => {
    const realCard: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const forgedCard: Card = { id: 'A-spades', rank: 'A', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [realCard]);

    const state: GameState = {
      roomId: 'room-auth-3',
      players: [p1],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    const result = RuleService.validateMove(state, 'p1', [forgedCard]);
    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, false);
    assert.ok(result.errors?.[0]?.includes('not in your hand'));
  });

  it('authenticates player using secret playerToken', () => {
    const p1 = createPlayer('p1', 'Alice', true);
    const p2 = createPlayer('p2', 'Bob', false);

    const room: GameRoom = {
      roomId: 'test-auth-room',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      gameStarted: true,
      createdAt: Date.now(),
    };

    // Correct token matches
    const authed1 = GameOrchestrator.authenticatePlayer(room, 'sock-unknown', 'p1', 'secret_token_p1');
    assert.ok(authed1);
    assert.equal(authed1?.id, 'p1');

    // Incorrect token is rejected
    const authed2 = GameOrchestrator.authenticatePlayer(room, 'sock-unknown', 'p1', 'invalid_token');
    assert.equal(authed2, null);

    // Impersonating someone else with wrong token is rejected
    const authed3 = GameOrchestrator.authenticatePlayer(room, 'sock-unknown', 'p2', 'secret_token_p1');
    assert.equal(authed3, null);
  });

  it('prevents non-creator from terminating a room', async () => {
    const p1 = createPlayer('p1', 'Alice', true);
    const p2 = createPlayer('p2', 'Bob', false);

    const room: GameRoom = {
      roomId: 'room-term-test',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      gameStarted: true,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    // Bob attempts to claim isCreator: true to terminate room
    const result = await GameOrchestrator.leaveGame(
      'room-term-test',
      'bob-socket',
      true, // Bob claims isCreator = true
      'p2',
      'secret_token_p2'
    );

    // Room must NOT be terminated! Bob is just removed as a regular player
    assert.equal(result.terminated, false);
    assert.equal(result.leavingPlayer?.id, 'p2');

    const updatedRoom = await RoomService.getRoom('room-term-test');
    assert.ok(updatedRoom);
    assert.equal(updatedRoom?.creatorId, 'p1');

    await RoomService.deleteRoom('room-term-test');
  });

  it('allows authenticated creator to terminate a room', async () => {
    const p1 = createPlayer('p1', 'Alice', true);
    const p2 = createPlayer('p2', 'Bob', false);

    const room: GameRoom = {
      roomId: 'room-term-test-creator',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      gameStarted: true,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    const result = await GameOrchestrator.leaveGame(
      'room-term-test-creator',
      'alice-socket',
      true,
      'p1',
      'secret_token_p1'
    );

    assert.equal(result.terminated, true);

    const roomAfter = await RoomService.getRoom('room-term-test-creator');
    assert.equal(roomAfter, null);
  });
});
