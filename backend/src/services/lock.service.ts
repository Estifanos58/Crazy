import crypto from 'node:crypto';
import redisService from '../config/redis';
import { logger } from '../utils/logger';

export class LockAcquisitionError extends Error {
  public readonly roomId: string;

  constructor(roomId: string, message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
    this.roomId = roomId;
  }
}

export interface LockOptions {
  ttlMs?: number;
  maxWaitMs?: number;
  retryDelayMs?: number;
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

export class RoomLockService {
  private static localQueues = new Map<string, Promise<unknown>>();
  private static LOCK_PREFIX = 'lock:room:';
  private static DEFAULT_TTL_MS = 5000;
  private static RETRY_DELAY_MS = 30;
  private static MAX_WAIT_MS = 4000;

  /**
   * Acquire a distributed lock via Redis with retries.
   * NEVER returns a token unless the lock was genuinely acquired.
   */
  static async acquireLock(roomId: string, options: LockOptions = {}): Promise<string> {
    const ttlMs = options.ttlMs ?? this.DEFAULT_TTL_MS;
    const maxWaitMs = options.maxWaitMs ?? this.MAX_WAIT_MS;
    const retryDelayMs = options.retryDelayMs ?? this.RETRY_DELAY_MS;

    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
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
          return token;
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
   * Extend the TTL of a lock we still own so long-running tasks do not lose exclusivity.
   */
  static async renewLock(roomId: string, token: string, ttlMs = this.DEFAULT_TTL_MS): Promise<boolean> {
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
   * Run an asynchronous task with per-room local serialization and distributed Redis lock.
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

    // 2. Distributed Redis lock with renewal heartbeat
    let lockToken: string | null = null;
    let renewInterval: NodeJS.Timeout | null = null;

    try {
      lockToken = await this.acquireLock(roomId, options);

      const renewPeriodMs = Math.max(100, Math.floor(ttlMs / 2));
      renewInterval = setInterval(() => {
        if (lockToken) {
          void this.renewLock(roomId, lockToken, ttlMs);
        }
      }, renewPeriodMs);
      if (typeof renewInterval.unref === 'function') {
        renewInterval.unref();
      }

      return await task();
    } finally {
      if (renewInterval) {
        clearInterval(renewInterval);
      }
      if (lockToken) {
        await this.releaseLock(roomId, lockToken);
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
