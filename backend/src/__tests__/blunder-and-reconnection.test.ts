import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameOrchestrator } from '../services/game.orchestrator';
import { BlunderService } from '../services/blunder.service';
import { RoomService } from '../services/room.service';
import type { Card, GameRoom, ServerPlayer } from '../types/game.types';

function createPlayer(
  id: string,
  username: string,
  isCreator = false,
  cards: Card[] = []
): ServerPlayer {
  return {
    id,
    token: `token_${id}_secret`,
    username,
    avatar: '🦊',
    cards,
    isCreator,
    connected: true,
  };
}

describe('Blunder Lifecycle, Server Timeout Enforcement & Zero Duplication', () => {
  it('does NOT duplicate cards when reverting a blunder', async () => {
    const blunderCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const otherCard: Card = { id: '4-clubs', rank: '4', suit: 'clubs' };
    const p1 = createPlayer('p1', 'Alice', true, [blunderCard, otherCard]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: '10-hearts', rank: '10', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId: 'room-blunder-1',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      gameStarted: true,
      gameOver: false,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    const playResult = await GameOrchestrator.playCard(
      'room-blunder-1',
      'alice-socket',
      [blunderCard],
      undefined,
      'p1',
      p1.token
    );

    assert.equal(playResult.success, true);
    assert.equal(playResult.isBlunder, true);

    const revertResult = await GameOrchestrator.revertBlunder(
      'room-blunder-1',
      'alice-socket',
      'p1',
      p1.token
    );

    assert.equal(revertResult.success, true);

    const roomAfterRevert = await RoomService.getRoom('room-blunder-1');
    const p1AfterRevert = roomAfterRevert?.players.find((p) => p.id === 'p1');
    assert.equal(p1AfterRevert?.cards.length, 2);
    assert.deepEqual(
      p1AfterRevert?.cards.map((c) => c.id).sort(),
      ['4-clubs', '9-spades'].sort()
    );
    assert.equal(roomAfterRevert?.blunderState, undefined);

    await RoomService.deleteRoom('room-blunder-1');
  });

  it('does NOT duplicate cards when a blunder is challenged with Call Crazy', async () => {
    const blunderCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [blunderCard]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: '10-hearts', rank: '10', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId: 'room-blunder-crazy',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [
        { id: '3-diamonds', rank: '3', suit: 'diamonds' },
        { id: '4-diamonds', rank: '4', suit: 'diamonds' },
      ],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      gameStarted: true,
      gameOver: false,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    await GameOrchestrator.playCard(
      'room-blunder-crazy',
      'alice-socket',
      [blunderCard],
      undefined,
      'p1',
      p1.token
    );

    const crazyResult = await GameOrchestrator.callCrazy(
      'room-blunder-crazy',
      'bob-socket',
      'p2',
      p2.token
    );

    assert.equal(crazyResult.success, true);

    const roomAfterCrazy = await RoomService.getRoom('room-blunder-crazy');
    const p1After = roomAfterCrazy?.players.find((p) => p.id === 'p1');
    assert.equal(p1After?.cards.length, 3);
    assert.equal(p1After?.cards.filter((c) => c.id === '9-spades').length, 1);

    await RoomService.deleteRoom('room-blunder-crazy');
  });

  it('rejects premature blunder timeout resolution inside BlunderService and resolves once expired', async () => {
    const blunderCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [blunderCard]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: '10-hearts', rank: '10', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId: 'room-blunder-timeout',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [
        { id: '3-diamonds', rank: '3', suit: 'diamonds' },
        { id: '4-diamonds', rank: '4', suit: 'diamonds' },
      ],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      gameStarted: true,
      gameOver: false,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    await GameOrchestrator.playCard(
      'room-blunder-timeout',
      'alice-socket',
      [blunderCard],
      undefined,
      'p1',
      p1.token
    );

    // Calling handleBlunderTimeout BEFORE expiration MUST be rejected!
    const premature = await BlunderService.handleBlunderTimeout('room-blunder-timeout');
    assert.equal(premature.resolved, false);
    assert.ok(premature.error?.includes('not expired'));

    const stillActive = await RoomService.getRoom('room-blunder-timeout');
    assert.equal(stillActive?.blunderState?.active, true);

    // Simulate elapsed challenge timeout
    stillActive!.blunderState!.timestamp = Date.now() - 9000;
    await RoomService.saveRoom(stillActive!);

    const expired = await BlunderService.handleBlunderTimeout('room-blunder-timeout');
    assert.equal(expired.resolved, true);

    const afterTimeout = await RoomService.getRoom('room-blunder-timeout');
    assert.equal(afterTimeout?.blunderState, undefined);
    assert.equal(afterTimeout?.currentTurn, 'p2');
    const aliceAfter = afterTimeout?.players.find((p) => p.id === 'p1');
    assert.equal(aliceAfter?.cards.length, 3); // 1 returned + 2 penalty

    await RoomService.deleteRoom('room-blunder-timeout');
  });
});

describe('Finished Player Reconnection & Game Restart', () => {
  it('allows finished players to reconnect with valid credentials and receive finished status', async () => {
    const finishedP1: ServerPlayer = {
      id: 'p1',
      token: 'token_p1_secret',
      username: 'Alice',
      avatar: '👑',
      cards: [],
      isCreator: true,
      rank: 1,
      finishedAt: Date.now() - 10000,
      connected: false,
    };
    const activeP2 = createPlayer('p2', 'Bob', false, [
      { id: '2-hearts', rank: '2', suit: 'hearts' },
    ]);

    const room: GameRoom = {
      roomId: 'room-finished-recon',
      creatorId: 'p1',
      players: [activeP2],
      finishedPlayers: [finishedP1],
      deck: [],
      pile: [{ id: 'K-hearts', rank: 'K', suit: 'hearts' }],
      currentTurn: 'p2',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      gameStarted: true,
      gameOver: false,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    const rejoinResult = await RoomService.rejoinRoom(
      'alice-new-socket',
      'room-finished-recon',
      'p1',
      'token_p1_secret'
    );

    assert.ok(rejoinResult);
    assert.equal(rejoinResult?.playerId, 'p1');
    assert.equal(rejoinResult?.player.rank, 1);
    assert.equal(rejoinResult?.player.cards.length, 0);

    await RoomService.deleteRoom('room-finished-recon');
  });

  it('restores finished players to active players on Play Again restart', async () => {
    const finishedP1: ServerPlayer = {
      id: 'p1',
      token: 'token_p1_secret',
      username: 'Alice',
      avatar: '👑',
      cards: [],
      isCreator: true,
      rank: 1,
      finishedAt: Date.now() - 5000,
      connected: true,
    };
    const activeP2 = createPlayer('p2', 'Bob', false, [
      { id: '2-hearts', rank: '2', suit: 'hearts' },
    ]);

    const room: GameRoom = {
      roomId: 'room-restart-test',
      creatorId: 'p1',
      players: [activeP2],
      finishedPlayers: [finishedP1],
      deck: [],
      gameStarted: false,
      gameOver: true,
      rules: { cardsPerPlayer: 5 },
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    const restartResult = await GameOrchestrator.playAgain(
      'room-restart-test',
      'alice-socket',
      'p1',
      'token_p1_secret'
    );

    assert.equal(restartResult.success, true);
    assert.ok(restartResult.room);
    assert.equal(restartResult.room?.players.length, 2);
    assert.equal(restartResult.room?.finishedPlayers?.length, 0);
    assert.equal(restartResult.room?.gameStarted, true);
    assert.equal(restartResult.room?.gameOver, false);

    const p1Restored = restartResult.room?.players.find((p) => p.id === 'p1');
    const p2Restored = restartResult.room?.players.find((p) => p.id === 'p2');
    assert.ok(p1Restored && p2Restored);
    const handSizes = [p1Restored.cards.length, p2Restored.cards.length].sort();
    assert.deepEqual(handSizes, [5, 6]);

    await RoomService.deleteRoom('room-restart-test');
  });
});
