import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { io as createClientSocket, type Socket as ClientSocket } from 'socket.io-client';
import redisService, { resolveRedisPolicy } from '../config/redis';
import { LockLostError, RoomLockService } from '../services/lock.service';
import { RoomService } from '../services/room.service';
import { BlunderService, BLUNDER_DEADLINES_KEY } from '../services/blunder.service';
import { TimerService } from '../services/timer.service';
import { GameOrchestrator } from '../services/game.orchestrator';
import { RuleService } from '../services/rule.service';
import { RateLimitService } from '../services/rate-limit.service';
import { createAppServer } from '../server';
import type { Card, GameRoom, GameState, ServerPlayer } from '../types/game.types';

before(async () => {
  if (process.env.TEST_REDIS_URL) {
    await redisService.connect(process.env.TEST_REDIS_URL);
  }
});

after(async () => {
  if (process.env.TEST_REDIS_URL) {
    await redisService.disconnect();
  }
});

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

function emitAck<TRes>(socket: ClientSocket, event: string, payload: unknown): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), 5000);
    socket.emit(event, payload, (response: TRes) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

describe('1. Production Redis Configuration Policy', () => {
  it('makes Redis mandatory in production and rejects memory/disabled overrides', () => {
    const prod = resolveRedisPolicy({ NODE_ENV: 'production' });
    assert.equal(prod.redisMandatory, true);
    assert.equal(prod.explicitMemoryOnly, false);

    assert.throws(
      () => resolveRedisPolicy({ NODE_ENV: 'production', ALLOW_MEMORY_STORE: 'true' }),
      /forbidden when NODE_ENV=production/
    );
    assert.throws(
      () => resolveRedisPolicy({ NODE_ENV: 'production', REDIS_USE_MEMORY: 'true' }),
      /forbidden when NODE_ENV=production/
    );
    assert.throws(
      () => resolveRedisPolicy({ NODE_ENV: 'production', REDIS_REQUIRED: 'false' }),
      /forbidden when NODE_ENV=production/
    );
  });

  it('requires explicit opt-in for memory fallback in development and permits it in test without REDIS_URL', () => {
    const devDefault = resolveRedisPolicy({ NODE_ENV: 'development' });
    assert.equal(devDefault.redisMandatory, true);
    assert.equal(devDefault.explicitMemoryOnly, false);

    const devOptIn = resolveRedisPolicy({ NODE_ENV: 'development', ALLOW_MEMORY_STORE: 'true' });
    assert.equal(devOptIn.redisMandatory, false);
    assert.equal(devOptIn.explicitMemoryOnly, true);

    const testMemory = resolveRedisPolicy({ NODE_ENV: 'test' });
    assert.equal(testMemory.explicitMemoryOnly, true);
  });
});

describe('2. Distributed Lock Renewal Failure & Fencing Protection', () => {
  it('blocks stale lock owner from writing room state after lock renewal fails', async () => {
    const roomId = 'fence-renew-fail-room';
    const initialRoom: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [createPlayer('p1', 'Alice', true)],
      gameStarted: true,
      deck: [],
      drawCount: 1,
      createdAt: Date.now(),
    };
    await RoomService.saveRoom(initialRoom);

    await assert.rejects(
      () =>
        RoomLockService.runWithLock(
          roomId,
          async () => {
            const activeLock = RoomLockService.getActiveLock(roomId);
            assert.ok(activeLock);

            // Simulate external lock loss (lock deleted/expired in Redis before renewal fires)
            await RoomLockService.releaseLock(roomId, activeLock.token);

            // Wait for renewal interval to detect loss
            await new Promise((resolve) => setTimeout(resolve, 140));

            // Attempt to save mutated state from stale owner -> MUST fail with LockLostError
            const staleRoom = (await RoomService.getRoom(roomId))!;
            staleRoom.drawCount = 999;
            await RoomService.saveRoom(staleRoom);
          },
          { ttlMs: 200, renewPeriodMs: 60 }
        ),
      LockLostError
    );

    // Persisted room state MUST remain untouched!
    const finalRoom = await RoomService.getRoom(roomId);
    assert.equal(finalRoom?.drawCount, 1);

    await RoomService.deleteRoom(roomId);
  });

  it('rejects stale conditional write when a newer owner holds the lock with a higher fencing token', async () => {
    const roomId = 'fence-stale-owner-room';
    const initialRoom: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [createPlayer('p1', 'Alice', true)],
      gameStarted: true,
      deck: [],
      drawCount: 10,
      createdAt: Date.now(),
    };
    await RoomService.saveRoom(initialRoom);

    await assert.rejects(
      () =>
        RoomLockService.runWithLock(
          roomId,
          async () => {
            const staleCtx = RoomLockService.getActiveLock(roomId)!;

            // Simulate lock expiration and acquisition by a second server instance (new lock + higher fence)
            await RoomLockService.releaseLock(roomId, staleCtx.token);
            const newer = await RoomLockService.acquireLockWithFence(roomId, { ttlMs: 3000 });
            assert.ok(newer.fenceToken > staleCtx.fenceToken);

            try {
              // Stale owner tries to persist without waiting for renewal tick -> Lua rejects atomically!
              const mutated = { ...initialRoom, drawCount: 777 };
              await RoomService.saveRoom(mutated);
            } finally {
              await RoomLockService.releaseLock(roomId, newer.token);
            }
          },
          { ttlMs: 5000, renewPeriodMs: 2500 }
        ),
      LockLostError
    );

    const stored = await RoomService.getRoom(roomId);
    assert.equal(stored?.drawCount, 10);

    await RoomService.deleteRoom(roomId);
  });
});

describe('3. Durable Blunder Deadlines Surviving Restart', () => {
  it('recovers and resolves expired blunder deadlines from Redis after in-memory timers are wiped', async () => {
    const roomId = 'durable-blunder-room';
    const blunderCard: Card = { id: '9-spades', rank: '9', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [blunderCard]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: '10-hearts', rank: '10', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [p1, p2],
      deck: [
        { id: '3-clubs', rank: '3', suit: 'clubs' },
        { id: '4-clubs', rank: '4', suit: 'clubs' },
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

    // Register a short-lived blunder (50ms challenge timeout) under room lock
    await RoomLockService.runWithLock(roomId, async () => {
      const latest = (await RoomService.getRoom(roomId))!;
      const alice = latest.players.find((p) => p.id === 'p1')!;
      await BlunderService.registerBlunderUnlocked(
        latest,
        alice,
        [blunderCard],
        'Wrong suit',
        undefined,
        { revertTimeoutMs: 30, challengeTimeoutMs: 60 }
      );
    });

    // Verify durable deadline exists in Redis ZSET
    const scheduled = await redisService.zRangeByScoreWithScores(
      BLUNDER_DEADLINES_KEY,
      '-inf',
      '+inf'
    );
    assert.ok(scheduled.some((entry) => entry.value === roomId));

    // Simulate process restart: wipe all in-memory timers, wait for deadline to elapse
    TimerService.clearAllTimers();
    await new Promise((resolve) => setTimeout(resolve, 90));

    // Recovery on boot must resolve the expired blunder under room lock
    const recovery = await BlunderService.recoverDeadlines();
    assert.ok(recovery.recoveredDue >= 1);

    const afterRecovery = await RoomService.getRoom(roomId);
    assert.equal(afterRecovery?.blunderState, undefined);
    assert.equal(afterRecovery?.currentTurn, 'p2');
    assert.equal(afterRecovery?.players.find((p) => p.id === 'p1')?.cards.length, 3);

    // Second timeout call MUST be strictly idempotent (no duplicate penalty)
    const secondCall = await BlunderService.handleBlunderTimeout(roomId);
    assert.equal(secondCall.resolved, false);
    const afterSecond = await RoomService.getRoom(roomId);
    assert.equal(afterSecond?.players.find((p) => p.id === 'p1')?.cards.length, 3);

    // Deadline entry must be cleaned up from Redis ZSET
    const remaining = await redisService.zRangeByScoreWithScores(
      BLUNDER_DEADLINES_KEY,
      '-inf',
      '+inf'
    );
    assert.equal(
      remaining.some((entry) => entry.value === roomId),
      false
    );

    await RoomService.deleteRoom(roomId);
  });
});

describe('4. Game Correctness: winOnEmpty & Atomic Room ID Allocation', () => {
  it('honors ruleConfig.winOnEmpty = false consistently in both RuleService and GameOrchestrator', async () => {
    const roomId = 'win-on-empty-false-room';
    const lastCard: Card = { id: '9-hearts', rank: '9', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', true, [lastCard]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: '10-hearts', rank: '10', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [p1, p2],
      finishedPlayers: [],
      deck: [{ id: '3-hearts', rank: '3', suit: 'hearts' }],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      gameStarted: true,
      gameOver: false,
      ruleConfig: RuleService.mergeConfig({ winOnEmpty: false }),
      createdAt: Date.now(),
    };
    await RoomService.saveRoom(room);

    const playRes = await GameOrchestrator.playCard(
      roomId,
      'alice-sock',
      [lastCard],
      undefined,
      'p1',
      p1.token
    );

    assert.equal(playRes.success, true);
    assert.equal(playRes.room?.gameOver, false);
    assert.equal(playRes.room?.gameStarted, true);
    assert.equal(playRes.room?.finishedPlayers?.length, 0);
    assert.equal(playRes.room?.players.length, 2);
    assert.equal(playRes.room?.currentTurn, 'p2');
    assert.equal(
      playRes.events.some((e) => e.type === 'player-finished' || e.type === 'game-over'),
      false
    );

    await RoomService.deleteRoom(roomId);
  });

  it('returns the actual winning player ID (0 cards) from RuleService.checkGameEnd', () => {
    const p1 = createPlayer('p1', 'Winner', true, []);
    const p2 = createPlayer('p2', 'Remaining', false, [{ id: '6-clubs', rank: '6', suit: 'clubs' }]);
    const state: GameState = {
      roomId: 'check-end-room',
      players: [p1, p2],
      deck: [],
      pile: [],
      currentTurn: 'p2',
      currentSuit: 'clubs',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    const endCheck = RuleService.checkGameEnd(state);
    assert.equal(endCheck.ended, true);
    assert.equal(endCheck.winner, 'p1');
  });

  it('allocates room IDs atomically without overwriting colliding rooms', async () => {
    const existing = await RoomService.createRoom('orig-sock', 'OriginalHost', '🦊');
    const existingId = existing.room.roomId;

    // Force first candidate to collide with existingId, second candidate to be fresh
    let calls = 0;
    const freshId = 'UNIQ99';
    RoomService.setRoomIdGenerator(() => {
      calls += 1;
      return calls === 1 ? existingId : freshId;
    });

    try {
      const created = await RoomService.createRoom('new-sock', 'NewHost', '🦁');
      assert.equal(created.room.roomId, freshId);
      assert.equal(calls, 2);

      // Original room MUST remain intact!
      const intact = await RoomService.getRoom(existingId);
      assert.equal(intact?.players[0].username, 'OriginalHost');

      // If all candidates collide, createRoom MUST fail instead of overwriting
      RoomService.setRoomIdGenerator(() => existingId);
      await assert.rejects(
        () => RoomService.createRoom('fail-sock', 'Attacker', '😈'),
        /Failed to allocate a unique room ID/
      );

      const stillIntact = await RoomService.getRoom(existingId);
      assert.equal(stillIntact?.players[0].username, 'OriginalHost');
    } finally {
      RoomService.setRoomIdGenerator(null);
      await RoomService.deleteRoom(existingId);
      await RoomService.deleteRoom(freshId);
    }
  });
});

describe('5. Rate Limiting, Enumeration Protection & Metrics Endpoint', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;
  const origMetricsToken = process.env.METRICS_TOKEN;

  before(async () => {
    RateLimitService.resetConnectionCounts();
    const { httpServer, io } = createAppServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    closeServer = async () => {
      BlunderService.stopRecoverySweeper();
      TimerService.clearAllTimers();
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      RateLimitService.resetConnectionCounts();
      if (origMetricsToken === undefined) {
        delete process.env.METRICS_TOKEN;
      } else {
        process.env.METRICS_TOKEN = origMetricsToken;
      }
    };
  });

  after(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it('enforces RateLimitService window limits accurately', async () => {
    const id = `unit-test-ip-${Date.now()}`;
    const rule = { limit: 3, windowMs: 5000 };

    assert.equal((await RateLimitService.consume('test-action', id, rule)).allowed, true);
    assert.equal((await RateLimitService.consume('test-action', id, rule)).allowed, true);
    assert.equal((await RateLimitService.consume('test-action', id, rule)).allowed, true);

    const fourth = await RateLimitService.consume('test-action', id, rule);
    assert.equal(fourth.allowed, false);
    assert.equal(fourth.count, 4);
  });

  it('throttles repeated invalid get-room lookups to prevent room enumeration', async () => {
    const scanner = createClientSocket(baseUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => scanner.once('connect', () => resolve()));

    try {
      let throttled = false;
      for (let i = 0; i < 12; i++) {
        const res = await emitAck<{ success: boolean; error?: string }>(
          scanner,
          'get-room',
          `NOPE${String(i).padStart(2, '0')}`
        );
        assert.equal(res.success, false);
        if (res.error?.toLowerCase().includes('too many')) {
          throttled = true;
          break;
        }
      }
      assert.equal(throttled, true);
    } finally {
      scanner.disconnect();
    }
  });

  it('enforces MAX_CONNECTIONS_PER_IP limit at Socket.IO handshake', async () => {
    const origMax = process.env.MAX_CONNECTIONS_PER_IP;
    process.env.MAX_CONNECTIONS_PER_IP = '2';
    RateLimitService.resetConnectionCounts();

    const s1 = createClientSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    const s2 = createClientSocket(baseUrl, { transports: ['websocket'], reconnection: false });
    const s3 = createClientSocket(baseUrl, { transports: ['websocket'], reconnection: false });

    try {
      await Promise.all([
        new Promise<void>((resolve) => s1.once('connect', () => resolve())),
        new Promise<void>((resolve) => s2.once('connect', () => resolve())),
      ]);

      const err = await new Promise<Error>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Expected 3rd connection to be rejected')), 4000);
        s3.once('connect', () => {
          clearTimeout(timer);
          reject(new Error('3rd connection should NOT have succeeded'));
        });
        s3.once('connect_error', (e) => {
          clearTimeout(timer);
          resolve(e);
        });
      });

      assert.ok(err.message.toLowerCase().includes('too many concurrent connections'));
    } finally {
      s1.disconnect();
      s2.disconnect();
      s3.disconnect();
      if (origMax === undefined) {
        delete process.env.MAX_CONNECTIONS_PER_IP;
      } else {
        process.env.MAX_CONNECTIONS_PER_IP = origMax;
      }
      RateLimitService.resetConnectionCounts();
    }
  });

  it('serves Prometheus and JSON metrics and honors METRICS_TOKEN auth', async () => {
    delete process.env.METRICS_TOKEN;

    const promRes = await fetch(`${baseUrl}/metrics`);
    assert.equal(promRes.status, 200);
    const promBody = await promRes.text();
    assert.ok(promBody.includes('crazy_active_socket_connections'));
    assert.ok(promBody.includes('crazy_locks_acquired_total'));

    const jsonRes = await fetch(`${baseUrl}/metrics`, {
      headers: { Accept: 'application/json' },
    });
    assert.equal(jsonRes.status, 200);
    const jsonBody = (await jsonRes.json()) as { counters: Record<string, number> };
    assert.equal(typeof jsonBody.counters.locks_acquired_total, 'number');

    // Enforce optional METRICS_TOKEN Bearer auth
    process.env.METRICS_TOKEN = 'super-secret-metrics-key';
    const unauthRes = await fetch(`${baseUrl}/metrics`);
    assert.equal(unauthRes.status, 401);

    const authRes = await fetch(`${baseUrl}/metrics`, {
      headers: { Authorization: 'Bearer super-secret-metrics-key' },
    });
    assert.equal(authRes.status, 200);
  });
});
