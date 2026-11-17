import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameOrchestrator } from '../services/game.orchestrator';
import { RoomService } from '../services/room.service';
import type { Card, GameRoom, ServerPlayer } from '../types/game.types';

function createPlayer(id: string, username: string, isCreator = false, cards: Card[] = []): ServerPlayer {
  return {
    id,
    token: `token_${id}`,
    username,
    avatar: '🤖',
    cards,
    isCreator,
    connected: true,
  };
}

describe('Blunder Lifecycle & No Card Duplication', () => {
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

    // 1. Play invalid card -> triggers blunder
    const playResult = await GameOrchestrator.playCard(
      'room-blunder-1',
      'alice-socket',
      [blunderCard],
      undefined,
      'p1',
      'token_p1'
    );

    assert.equal(playResult.success, true);
    assert.equal(playResult.isBlunder, true);

    const roomInBlunder = await RoomService.getRoom('room-blunder-1');
    const p1InBlunder = roomInBlunder?.players.find(p => p.id === 'p1');
    // Blunder card was temporarily moved from player hand into blunderState
    assert.equal(p1InBlunder?.cards.length, 1);
    assert.equal(roomInBlunder?.blunderState?.active, true);
    assert.equal(roomInBlunder?.blunderState?.cards[0].id, '9-spades');

    // 2. Revert the blunder
    const revertResult = await GameOrchestrator.revertBlunder(
      'room-blunder-1',
      'alice-socket',
      'p1',
      'token_p1'
    );

    assert.equal(revertResult.success, true);

    const roomAfterRevert = await RoomService.getRoom('room-blunder-1');
    const p1AfterRevert = roomAfterRevert?.players.find(p => p.id === 'p1');

    // Alice must have exactly 2 cards (her original hand), with ZERO DUPLICATES!
    assert.equal(p1AfterRevert?.cards.length, 2);
    const cardIds = p1AfterRevert?.cards.map(c => c.id);
    assert.deepEqual(cardIds?.sort(), ['4-clubs', '9-spades'].sort());
    assert.equal(roomAfterRevert?.blunderState, undefined);

    await RoomService.deleteRoom('room-blunder-1');
  });

  it('does NOT duplicate cards when a blunder is challenged with Call Crazy', async () => {
    const blunderCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [blunderCard]);
    const p2 = createPlayer('p2', 'Bob', false, []);

    const room: GameRoom = {
      roomId: 'room-blunder-crazy',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [
        { id: 'deck-1', rank: '3', suit: 'diamonds' },
        { id: 'deck-2', rank: '4', suit: 'diamonds' },
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

    // Alice blunders
    await GameOrchestrator.playCard(
      'room-blunder-crazy',
      'alice-socket',
      [blunderCard],
      undefined,
      'p1',
      'token_p1'
    );

    // Bob calls crazy
    const crazyResult = await GameOrchestrator.callCrazy(
      'room-blunder-crazy',
      'bob-socket',
      'p2',
      'token_p2'
    );

    assert.equal(crazyResult.success, true);

    const roomAfterCrazy = await RoomService.getRoom('room-blunder-crazy');
    const p1After = roomAfterCrazy?.players.find(p => p.id === 'p1');

    // Alice gets 1 original card back + 2 penalty cards = 3 cards total (no duplicate of 9-spades!)
    assert.equal(p1After?.cards.length, 3);
    const spade9Count = p1After?.cards.filter(c => c.id === '9-spades').length;
    assert.equal(spade9Count, 1);

    await RoomService.deleteRoom('room-blunder-crazy');
  });
});

describe('Finished Player Reconnection & Game Restart', () => {
  it('allows finished players to reconnect and receive finished status', async () => {
    const finishedP1: ServerPlayer = {
      id: 'p1',
      token: 'token_p1',
      username: 'Alice',
      avatar: '👑',
      cards: [],
      isCreator: true,
      rank: 1,
      finishedAt: Date.now() - 10000,
      connected: false,
    };
    const activeP2 = createPlayer('p2', 'Bob', false, [{ id: '2-hearts', rank: '2', suit: 'hearts' }]);

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

    // Alice reconnects with a brand new socket
    const rejoinResult = await RoomService.rejoinRoom(
      'alice-new-socket',
      'room-finished-recon',
      'p1',
      'token_p1'
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
      token: 'token_p1',
      username: 'Alice',
      avatar: '👑',
      cards: [],
      isCreator: true,
      rank: 1,
      finishedAt: Date.now() - 5000,
      connected: true,
    };
    const activeP2 = createPlayer('p2', 'Bob', false, [{ id: '2-hearts', rank: '2', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId: 'room-restart-test',
      creatorId: 'p1',
      players: [activeP2],
      finishedPlayers: [finishedP1],
      deck: [],
      gameStarted: true,
      gameOver: true,
      rules: { cardsPerPlayer: 5 },
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    // Creator Alice requests Play Again
    const restartResult = await GameOrchestrator.playAgain(
      'room-restart-test',
      'alice-socket',
      'p1',
      'token_p1'
    );

    assert.equal(restartResult.success, true);
    assert.ok(restartResult.room);

    // Both players must be restored in active players list with fresh hands!
    assert.equal(restartResult.room?.players.length, 2);
    assert.equal(restartResult.room?.finishedPlayers?.length, 0);
    assert.equal(restartResult.room?.gameStarted, true);
    assert.equal(restartResult.room?.gameOver, false);

    const p1Restored = restartResult.room?.players.find(p => p.id === 'p1');
    const p2Restored = restartResult.room?.players.find(p => p.id === 'p2');
    assert.ok(p1Restored);
    assert.ok(p2Restored);
    const handSizes = [p1Restored?.cards.length, p2Restored?.cards.length].sort();
    assert.deepEqual(handSizes, [5, 6]);

    await RoomService.deleteRoom('room-restart-test');
  });
});
