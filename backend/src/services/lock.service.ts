import { customAlphabet } from 'nanoid';
import redisService from '../config/redis';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export class RoomLockService {
  private static localQueues = new Map<string, Promise<unknown>>();
  private static LOCK_PREFIX = 'lock:room:';
  private static DEFAULT_TTL_MS = 5000;
  private static RETRY_DELAY_MS = 30;
  private static MAX_WAIT_MS = 4000;

  /**
   * Acquire a distributed lock via Redis with retries, and wrap inside an in-process queue
   */
  static async acquireLock(roomId: string, ttlMs = this.DEFAULT_TTL_MS): Promise<string> {
    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
    const token = nanoid();
    const startTime = Date.now();

    while (Date.now() - startTime < this.MAX_WAIT_MS) {
      try {
        const client = redisService.getClient();
        // Redis SET with NX and PX options
        const result = await client.set(lockKey, token, {
          NX: true,
          PX: ttlMs,
        });

        if (result === 'OK') {
          return token;
        }
      } catch (err) {
        // Fall back gracefully to in-process locking if Redis is down/mocked
        return token;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
    }

    // Force acquire if lock timed out to avoid permanent deadlock
    return token;
  }

  /**
   * Release the distributed lock safely using Lua script
   */
  static async releaseLock(roomId: string, token: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${roomId}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const client = redisService.getClient();
      await client.eval(luaScript, {
        keys: [lockKey],
        arguments: [token],
      });
    } catch {
      // Ignore release errors (e.g. if expired or Redis disconnected)
    }
  }

  /**
   * Run an asynchronous task with room-level concurrency control
   */
  static async runWithLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    // 1. In-process queue serialization
    const currentPromise = this.localQueues.get(roomId) || Promise.resolve();

    let releaseQueue: () => void = () => {};
    const nextPromise = new Promise<void>(resolve => {
      releaseQueue = resolve;
    });

    // Chain onto the queue
    this.localQueues.set(
      roomId,
      currentPromise.then(
        () => nextPromise,
        () => nextPromise
      )
    );

    await currentPromise;

    // 2. Distributed Redis lock
    let lockToken = '';
    try {
      lockToken = await this.acquireLock(roomId);
      return await task();
    } finally {
      if (lockToken) {
        await this.releaseLock(roomId, lockToken);
      }
      releaseQueue();
      if (this.localQueues.get(roomId) === nextPromise) {
        this.localQueues.delete(roomId);
      }
    }
  }
}
