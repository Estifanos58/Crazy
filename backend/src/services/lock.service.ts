import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import redisService from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export class LockAcquisitionError extends Error {
  public readonly roomId: string;

  constructor(roomId: string, message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
    this.roomId = roomId;
  }
}

export class LockLostError extends Error {
  public readonly roomId: string;

  constructor(roomId: string, message: string) {
    super(message);
    this.name = 'LockLostError';
    this.roomId = roomId;
  }
}

export interface LockOptions {
  ttlMs?: number;
  maxWaitMs?: number;
  retryDelayMs?: number;
  renewPeriodMs?: number;
}

export interface ActiveRoomLock {
  roomId: string;
  lockKey: string;
  token: string;
  fenceToken: number;
  lost: boolean;
  lostReason?: string;
}

const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const RENEW_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

const SAVE_ROOM_FENCED_LUA = `
  -- SAVE_ROOM_FENCED
  if redis.call("get", KEYS[1]) ~= ARGV[1] then
    return 0
  end
  local currentFence = tonumber(redis.call("get", KEYS[3]) or "0")
  local myFence = tonumber(ARGV[4])
  if myFence < currentFence then
    return -1
  end
  redis.call("set", KEYS[2], ARGV[2], "EX", tonumber(ARGV[3]))
  redis.call("set", KEYS[3], ARGV[4], "EX", tonumber(ARGV[3]))
  return 1
`;

const DELETE_ROOM_FENCED_LUA = `
  -- DELETE_ROOM_FENCED
  if redis.call("get", KEYS[1]) ~= ARGV[1] then
    return 0
  end
  local currentFence = tonumber(redis.call("get", KEYS[3]) or "0")
  local myFence = tonumber(ARGV[2])
  if myFence < currentFence then
    return -1
  end
  redis.call("del", KEYS[2])
  redis.call("del", KEYS[3])
  return 1
`;

export class RoomLockService {
  private static localQueues = new Map<string, Promise<unknown>>();
  private static lockContext = new AsyncLocalStorage<ActiveRoomLock>();
  private static LOCK_PREFIX = 'lock:room:';
  private static FENCE_COUNTER_PREFIX = 'lock:fence:';
  private static ROOM_FENCE_PREFIX = 'room:fence:';
  private static DEFAULT_TTL_MS = 5000;
  private static RETRY_DELAY_MS = 30;
  private static MAX_WAIT_MS = 4000;

  /**
   * Returns the currently held lock context for a room (if executing inside runWithLock).
   */
  static getActiveLock(roomId?: string): ActiveRoomLock | undefined {
    const ctx = this.lockContext.getStore();
    if (!ctx) return undefined;
    if (roomId !== undefined && ctx.roomId !== roomId) return undefined;
    return ctx;
  }

  /**
   * Throws LockLostError if the current lock context for `roomId` has been lost.
   */
  static assertLockHeld(roomId: string): ActiveRoomLock {
    const ctx = this.getActiveLock(roomId);
    if (!ctx) {
      throw new LockLostError(roomId, `No active lock held for room ${roomId}`);
    }
    if (ctx.lost) {
      throw new LockLostError(
        roomId,
        ctx.lostReason || `Lock ownership lost for room ${roomId}`
      );
    }
    return ctx;
  }

  /**
   * Acquire a distributed lock via Redis with retries.
   * NEVER returns unless the lock was genuinely acquired.
   */
  static async acquireLockWithFence(
    roomId: string,
    options: LockOptions = {}
  ): Promise<{ token: string; fenceToken: number }> {
    const ttlMs = options.ttlMs ?? this.DEFAULT_TTL_MS;
    const maxWaitMs = options.maxWaitMs ?? this.MAX_WAIT_MS;
    const retryDelayMs = options.retryDelayMs ?? this.RETRY_DELAY_MS;

    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
    const fenceCounterKey = `${this.FENCE_COUNTER_PREFIX}${roomId}`;
    const token = crypto.randomBytes(16).toString('hex');
    const deadline = Date.now() + maxWaitMs;
    let lastError: unknown = null;

    while (true) {
      try {
        const client = redisService.getClient();
        const result = await client.set(lockKey, token, {
          NX: true,
          PX: ttlMs,
        });

        if (result === 'OK') {
          try {
            const fenceToken = await client.incr(fenceCounterKey);
            metrics.inc('locks_acquired_total');
            return { token, fenceToken };
          } catch (fenceErr) {
            // Release immediately if we failed to mint a fencing token
            await this.releaseLock(roomId, token);
            throw fenceErr;
          }
        }
        lastError = null;
      } catch (err) {
        lastError = err;
        logger.warn('Redis lock acquisition attempt failed', {
          roomId,
          error: err instanceof Error ? err : String(err),
        });
      }

      if (Date.now() >= deadline) {
        break;
      }

      const remaining = Math.max(0, deadline - Date.now());
      const jitter = crypto.randomInt(0, Math.max(1, Math.floor(retryDelayMs / 2)));
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs + jitter, remaining)));
    }

    metrics.inc('locks_acquire_failed_total');

    if (lastError) {
      throw new LockAcquisitionError(
        roomId,
        `Failed to acquire distributed lock for room ${roomId} due to Redis error`
      );
    }

    throw new LockAcquisitionError(
      roomId,
      `Timed out waiting to acquire lock for room ${roomId}`
    );
  }

  /**
   * Backwards-compatible acquireLock returning the lock token.
   */
  static async acquireLock(roomId: string, options: LockOptions = {}): Promise<string> {
    const { token } = await this.acquireLockWithFence(roomId, options);
    return token;
  }

  /**
   * Extend the TTL of a lock we still own so long-running tasks do not lose exclusivity.
   */
  static async renewLock(
    roomId: string,
    token: string,
    ttlMs = this.DEFAULT_TTL_MS
  ): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
    try {
      const client = redisService.getClient();
      const result = await client.eval(RENEW_LOCK_LUA, {
        keys: [lockKey],
        arguments: [token, String(ttlMs)],
      });
      return Number(result) === 1;
    } catch (err) {
      logger.warn('Failed to renew room lock', {
        roomId,
        error: err instanceof Error ? err : String(err),
      });
      return false;
    }
  }

  /**
   * Release the distributed lock safely using compare-and-delete Lua script.
   */
  static async releaseLock(roomId: string, token: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
    try {
      const client = redisService.getClient();
      await client.eval(RELEASE_LOCK_LUA, {
        keys: [lockKey],
        arguments: [token],
      });
    } catch (err) {
      logger.warn('Failed to release room lock', {
        roomId,
        error: err instanceof Error ? err : String(err),
      });
    }
  }

  /**
   * Atomically persist room state ONLY IF we still hold the distributed lock AND our fencing token is current.
   * Prevents stale lock owners from clobbering newer state after GC pauses or renewal failures.
   */
  static async saveRoomWithFence(
    roomId: string,
    roomKey: string,
    serializedRoom: string,
    expirySeconds: number
  ): Promise<void> {
    const activeLock = this.assertLockHeld(roomId);
    const fenceKey = `${this.ROOM_FENCE_PREFIX}${roomId}`;

    const client = redisService.getClient();
    const status = Number(
      await client.eval(SAVE_ROOM_FENCED_LUA, {
        keys: [activeLock.lockKey, roomKey, fenceKey],
        arguments: [
          activeLock.token,
          serializedRoom,
          String(expirySeconds),
          String(activeLock.fenceToken),
        ],
      })
    );

    if (status !== 1) {
      activeLock.lost = true;
      activeLock.lostReason =
        status === -1
          ? `Stale fencing token (${activeLock.fenceToken}) rejected for room ${roomId}`
          : `Lock ownership lost before saving room ${roomId}`;
      metrics.inc('locks_stale_write_blocked_total');
      logger.error('Blocked stale room write', {
        roomId,
        fenceToken: activeLock.fenceToken,
        status,
      });
      throw new LockLostError(roomId, activeLock.lostReason);
    }
  }

  /**
   * Atomically delete room state ONLY IF we still hold the distributed lock AND our fencing token is current.
   */
  static async deleteRoomWithFence(roomId: string, roomKey: string): Promise<void> {
    const activeLock = this.assertLockHeld(roomId);
    const fenceKey = `${this.ROOM_FENCE_PREFIX}${roomId}`;

    const client = redisService.getClient();
    const status = Number(
      await client.eval(DELETE_ROOM_FENCED_LUA, {
        keys: [activeLock.lockKey, roomKey, fenceKey],
        arguments: [activeLock.token, String(activeLock.fenceToken)],
      })
    );

    if (status !== 1) {
      activeLock.lost = true;
      activeLock.lostReason = `Lock ownership lost before deleting room ${roomId}`;
      metrics.inc('locks_stale_write_blocked_total');
      logger.error('Blocked stale room delete', {
        roomId,
        fenceToken: activeLock.fenceToken,
        status,
      });
      throw new LockLostError(roomId, activeLock.lostReason);
    }
  }

  /**
   * Run an asynchronous task with per-room local serialization, distributed Redis lock,
   * active renewal monitoring, and fencing context for conditional writes.
   */
  static async runWithLock<T>(
    roomId: string,
    task: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const ttlMs = options.ttlMs ?? this.DEFAULT_TTL_MS;

    // 1. In-process queue serialization
    const previousTail = this.localQueues.get(roomId) || Promise.resolve();

    let releaseQueue: () => void = () => {};
    const currentSlot = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    const queueEntry = previousTail.then(
      () => currentSlot,
      () => currentSlot
    );
    this.localQueues.set(roomId, queueEntry);

    await previousTail.catch(() => undefined);

    // 2. Distributed Redis lock with renewal heartbeat and failure tracking
    let activeLock: ActiveRoomLock | null = null;
    let renewInterval: NodeJS.Timeout | null = null;
    let renewalInFlight = false;

    try {
      const { token, fenceToken } = await this.acquireLockWithFence(roomId, options);
      activeLock = {
        roomId,
        lockKey: `${this.LOCK_PREFIX}${roomId}`,
        token,
        fenceToken,
        lost: false,
      };

      const renewPeriodMs = options.renewPeriodMs ?? Math.max(80, Math.floor(ttlMs / 2));
      renewInterval = setInterval(() => {
        if (!activeLock || activeLock.lost || renewalInFlight) return;
        renewalInFlight = true;
        const currentLock = activeLock;

        void this.renewLock(roomId, currentLock.token, ttlMs)
          .then((renewed) => {
            if (!renewed) {
              currentLock.lost = true;
              currentLock.lostReason = `Lock renewal failed for room ${roomId}`;
              metrics.inc('locks_renew_failed_total');
              logger.error('Room lock renewal failed; marking lock lost', {
                roomId,
                fenceToken: currentLock.fenceToken,
              });
              if (renewInterval) {
                clearInterval(renewInterval);
                renewInterval = null;
              }
            }
          })
          .finally(() => {
            renewalInFlight = false;
          });
      }, renewPeriodMs);

      if (typeof renewInterval.unref === 'function') {
        renewInterval.unref();
      }

      const result = await this.lockContext.run(activeLock, () => task());

      if (activeLock.lost) {
        throw new LockLostError(
          roomId,
          activeLock.lostReason || `Lock ownership lost during operation on room ${roomId}`
        );
      }

      return result;
    } finally {
      if (renewInterval) {
        clearInterval(renewInterval);
      }
      if (activeLock && !activeLock.lost) {
        await this.releaseLock(roomId, activeLock.token);
      }
      releaseQueue();
      if (this.localQueues.get(roomId) === queueEntry) {
        this.localQueues.delete(roomId);
      }
    }
  }

  static getActiveQueueCount(): number {
    return this.localQueues.size;
  }

  static hasPendingQueue(roomId: string): boolean {
    return this.localQueues.has(roomId);
  }
}
