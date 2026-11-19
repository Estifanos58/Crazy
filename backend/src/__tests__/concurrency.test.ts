import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import redisService from '../config/redis';
import { LockAcquisitionError, RoomLockService } from '../services/lock.service';
import { RoomService } from '../services/room.service';
import type { GameRoom } from '../types/game.types';

describe('Concurrency Control, Distributed Lock Safety & Queue Cleanup', () => {
  it('serializes concurrent operations on the same room and cleans up localQueues', async () => {
    const roomId = 'concurrency-room-test';
    const initialRoom: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [
        {
          id: 'p1',
          token: 'token_p1',
          username: 'Alice',
          avatar: '🦊',
          cards: [],
          isCreator: true,
          connected: true,
        },
      ],
      gameStarted: true,
      deck: [],
      drawCount: 0,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(initialRoom);

    const operations = Array.from({ length: 10 }).map(() => {
      return RoomLockService.runWithLock(roomId, async () => {
        const room = await RoomService.getRoom(roomId);
        if (!room) throw new Error('Room not found');
        await new Promise((resolve) => setTimeout(resolve, 10));
        room.drawCount = (room.drawCount || 0) + 1;
        await RoomService.saveRoom(room);
        return room.drawCount;
      });
    });

    await Promise.all(operations);

    const finalRoom = await RoomService.getRoom(roomId);
    assert.equal(finalRoom?.drawCount, 10);
    // Queue entry MUST be cleaned up to prevent memory leak
    assert.equal(RoomLockService.hasPendingQueue(roomId), false);

    await RoomService.deleteRoom(roomId);
  });

  it('NEVER executes task when lock acquisition times out (held by another owner)', async () => {
    const roomId = 'lock-contention-room';
    const heldToken = await RoomLockService.acquireLock(roomId, { ttlMs: 5000 });

    let taskExecuted = false;
    try {
      await assert.rejects(
        () =>
          RoomLockService.runWithLock(
            roomId,
            async () => {
              taskExecuted = true;
              return 'should-not-run';
            },
            { maxWaitMs: 120, retryDelayMs: 25 }
          ),
        LockAcquisitionError
      );
      assert.equal(taskExecuted, false);
      assert.equal(RoomLockService.hasPendingQueue(roomId), false);
    } finally {
      await RoomLockService.releaseLock(roomId, heldToken);
    }
  });

  it('NEVER executes task when Redis lock client throws an error', async () => {
    const roomId = 'lock-redis-failure-room';
    let taskExecuted = false;

    redisService.setLockClientOverride({
      set: async () => {
        throw new Error('ECONNREFUSED Redis down');
      },
      incr: async () => {
        throw new Error('ECONNREFUSED Redis down');
      },
      eval: async () => 0,
    });

    try {
      await assert.rejects(
        () =>
          RoomLockService.runWithLock(
            roomId,
            async () => {
              taskExecuted = true;
              return 'should-not-run';
            },
            { maxWaitMs: 100, retryDelayMs: 20 }
          ),
        LockAcquisitionError
      );
      assert.equal(taskExecuted, false);
      assert.equal(RoomLockService.hasPendingQueue(roomId), false);
    } finally {
      redisService.setLockClientOverride(null);
    }
  });

  it('renews lock TTL automatically while a long task is still running', async () => {
    const roomId = 'lock-renewal-room';

    const result = await RoomLockService.runWithLock(
      roomId,
      async () => {
        // Sleep longer than ttlMs (220ms) while renewal extends every ~110ms
        await new Promise((resolve) => setTimeout(resolve, 340));

        // Lock must STILL be held so another direct acquireLock fails!
        await assert.rejects(
          () => RoomLockService.acquireLock(roomId, { maxWaitMs: 40, retryDelayMs: 15 }),
          LockAcquisitionError
        );
        return 'ok';
      },
      { ttlMs: 220, maxWaitMs: 500, retryDelayMs: 20 }
    );

    assert.equal(result, 'ok');
    assert.equal(RoomLockService.hasPendingQueue(roomId), false);
  });

  it('prevents race conditions when two players concurrently join with the same username', async () => {
    const created = await RoomService.createRoom('host-sock', 'Host', '🦊');
    const roomId = created.room.roomId;

    const results = await Promise.allSettled([
      RoomService.joinRoom('sock-a', { roomId, username: 'Rival', avatar: '🦁' }),
      RoomService.joinRoom('sock-b', { roomId, username: 'rival', avatar: '🐯' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const room = await RoomService.getRoom(roomId);
    assert.equal(room?.players.length, 2);

    await RoomService.deleteRoom(roomId);
  });
});
