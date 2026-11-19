import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface LockClient {
  set(
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number; EX?: number }
  ): Promise<string | null>;
  incr(key: string): Promise<number>;
  eval(script: string, config: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

interface MemoryItem {
  value: string;
  expiry?: number;
}

/**
 * Determine whether in-memory fallback is permitted under the current environment policy.
 * - Production (`NODE_ENV === 'production'`): Redis is ALWAYS mandatory; memory fallback is NEVER allowed.
 * - Test (`NODE_ENV === 'test'`): allowed when no REDIS_URL is configured or explicitly opted in.
 * - Development: allowed ONLY when explicitly opted in via ALLOW_MEMORY_STORE=true (or REDIS_USE_MEMORY=true).
 */
export function resolveRedisPolicy(env: NodeJS.ProcessEnv = process.env): {
  redisMandatory: boolean;
  explicitMemoryOnly: boolean;
} {
  const isProduction = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const memoryOptIn = env.ALLOW_MEMORY_STORE === 'true' || env.REDIS_USE_MEMORY === 'true';

  if (isProduction) {
    if (memoryOptIn) {
      throw new Error(
        'In-memory store fallback (ALLOW_MEMORY_STORE / REDIS_USE_MEMORY) is forbidden when NODE_ENV=production'
      );
    }
    if (env.REDIS_REQUIRED === 'false') {
      throw new Error('REDIS_REQUIRED=false is forbidden when NODE_ENV=production');
    }
    return { redisMandatory: true, explicitMemoryOnly: false };
  }

  if (isTest) {
    const explicitMemoryOnly = memoryOptIn || !env.REDIS_URL;
    return {
      redisMandatory: env.REDIS_REQUIRED === 'true' && !explicitMemoryOnly,
      explicitMemoryOnly,
    };
  }

  // Development: Redis is required by default unless explicitly opted into memory mode
  if (memoryOptIn) {
    return { redisMandatory: false, explicitMemoryOnly: true };
  }
  return {
    redisMandatory: env.REDIS_REQUIRED !== 'false',
    explicitMemoryOnly: false,
  };
}

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private mode: 'redis' | 'memory' = 'redis';
  private connectAttempts = 0;
  private readonly maxConnectAttempts = 5;
  private memoryStore: Map<string, MemoryItem> = new Map();
  private memorySortedSets: Map<string, Map<string, number>> = new Map();
  private customLockClientOverride: LockClient | null = null;

  constructor() {
    const policy = resolveRedisPolicy(process.env);
    if (policy.explicitMemoryOnly) {
      this.mode = 'memory';
      this.client = null;
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.mode = 'redis';
    this.initClient(redisUrl);
  }

  private initClient(redisUrl: string): void {
    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 500, 3000);
          },
        },
      });

      this.client.on('error', (err: unknown) => {
        this.isConnected = false;
        logger.warn('Redis client error', { error: err instanceof Error ? err : String(err) });
      });

      this.client.on('connect', () => {
        logger.info('Redis socket connected');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.mode = 'redis';
        logger.info('Redis client ready');
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });
    } catch (err) {
      logger.error('Failed to initialize Redis client', {
        error: err instanceof Error ? err : String(err),
      });
      this.client = null;
    }
  }

  private getMemoryItem(key: string): MemoryItem | undefined {
    const item = this.memoryStore.get(key);
    if (!item) return undefined;
    if (item.expiry && Date.now() > item.expiry) {
      this.memoryStore.delete(key);
      return undefined;
    }
    return item;
  }

  isRedisMandatory(): boolean {
    return resolveRedisPolicy(process.env).redisMandatory;
  }

  async connect(redisUrlOverride?: string): Promise<void> {
    const policy = resolveRedisPolicy(process.env);

    if (redisUrlOverride) {
      await this.disconnect();
      this.connectAttempts = 0;
      this.mode = 'redis';
      this.initClient(redisUrlOverride);
    } else if (policy.explicitMemoryOnly) {
      this.mode = 'memory';
      return;
    } else if (!this.client) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.mode = 'redis';
      this.initClient(redisUrl);
    }

    if (this.isConnected) {
      return;
    }

    if (!this.client) {
      throw new Error('Redis client could not be initialized');
    }

    while (!this.isConnected && this.connectAttempts < this.maxConnectAttempts) {
      try {
        this.connectAttempts += 1;
        logger.info('Connecting to Redis', {
          attempt: this.connectAttempts,
          maxAttempts: this.maxConnectAttempts,
        });
        await this.client.connect();
        this.isConnected = true;
        this.mode = 'redis';
        logger.info('Connected to Redis');
        return;
      } catch (error) {
        logger.warn('Redis connection attempt failed', {
          attempt: this.connectAttempts,
          error: error instanceof Error ? error : String(error),
        });
        if (this.connectAttempts >= this.maxConnectAttempts) {
          if (policy.redisMandatory) {
            throw new Error(
              'Failed to connect to Redis after maximum attempts (Redis is mandatory in this environment)'
            );
          }
          logger.warn('Redis unavailable; using explicitly permitted non-production memory store');
          this.mode = 'memory';
          return;
        }
        const delayMs = Math.min(this.connectAttempts * 500, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        if (this.client.isOpen) {
          await this.client.quit();
        }
      } catch {
        try {
          await this.client.disconnect();
        } catch {
          // Ignore disconnect errors on shutdown
        }
      }
      this.isConnected = false;
    }
  }

  async ping(): Promise<boolean> {
    if (this.mode === 'memory') {
      return !this.isRedisMandatory();
    }
    if (!this.client || !this.isConnected) {
      return false;
    }
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  getMode(): 'redis' | 'memory' {
    return this.mode;
  }

  isReady(): boolean {
    if (this.mode === 'redis') {
      return this.isConnected && Boolean(this.client?.isReady);
    }
    return !this.isRedisMandatory();
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      if (expirySeconds) {
        await this.client.setEx(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return;
    }

    const expiry = expirySeconds ? Date.now() + expirySeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiry });
  }

  /**
   * Atomic create-only set (`SET key value NX EX expirySeconds`). Returns true if created, false if key already exists.
   */
  async setIfNotExists(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      const result = await this.client.set(key, value, {
        NX: true,
        ...(expirySeconds ? { EX: expirySeconds } : {}),
      });
      return result === 'OK';
    }

    const existing = this.getMemoryItem(key);
    if (existing) {
      return false;
    }
    const expiry = expirySeconds ? Date.now() + expirySeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiry });
    return true;
  }

  async get(key: string): Promise<string | null> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      return await this.client.get(key);
    }

    return this.getMemoryItem(key)?.value ?? null;
  }

  async delete(key: string): Promise<void> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      await this.client.del(key);
      return;
    }

    this.memoryStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      const result = await this.client.exists(key);
      return result === 1;
    }

    return this.getMemoryItem(key) !== undefined;
  }

  // ============ SORTED SET HELPERS (FOR DURABLE TIMERS) ============

  async zAdd(key: string, score: number, member: string): Promise<void> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      await this.client.zAdd(key, { score, value: member });
      return;
    }

    let zset = this.memorySortedSets.get(key);
    if (!zset) {
      zset = new Map();
      this.memorySortedSets.set(key, zset);
    }
    zset.set(member, score);
  }

  async zRem(key: string, member: string): Promise<void> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      await this.client.zRem(key, member);
      return;
    }

    const zset = this.memorySortedSets.get(key);
    if (zset) {
      zset.delete(member);
      if (zset.size === 0) {
        this.memorySortedSets.delete(key);
      }
    }
  }

  async zRangeByScoreWithScores(
    key: string,
    min: number | '-inf',
    max: number | '+inf'
  ): Promise<Array<{ value: string; score: number }>> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      const entries = await this.client.zRangeByScoreWithScores(key, min, max);
      return entries.map((entry) => ({ value: entry.value, score: entry.score }));
    }

    const zset = this.memorySortedSets.get(key);
    if (!zset) return [];

    const minVal = min === '-inf' ? -Infinity : min;
    const maxVal = max === '+inf' ? Infinity : max;
    const results: Array<{ value: string; score: number }> = [];

    for (const [value, score] of zset.entries()) {
      if (score >= minVal && score <= maxVal) {
        results.push({ value, score });
      }
    }

    return results.sort((a, b) => a.score - b.score);
  }

  /**
   * Returns the low-level lock/script client.
   * In Redis mode, NEVER silently falls back to memory if Redis is down.
   */
  getClient(): LockClient {
    if (this.customLockClientOverride) {
      return this.customLockClientOverride;
    }

    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis lock client unavailable');
      }
      return this.client as unknown as LockClient;
    }

    // Explicit non-production in-memory atomic client mirroring Redis Lua script semantics
    return {
      set: async (
        key: string,
        token: string,
        options?: { NX?: boolean; PX?: number; EX?: number }
      ) => {
        const existing = this.getMemoryItem(key);
        if (options?.NX && existing) {
          return null;
        }
        const ttlMs =
          options?.PX !== undefined
            ? options.PX
            : options?.EX !== undefined
            ? options.EX * 1000
            : undefined;
        const expiry = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
        this.memoryStore.set(key, { value: token, expiry });
        return 'OK';
      },
      incr: async (key: string) => {
        const existing = this.getMemoryItem(key);
        const nextVal = (existing ? Number(existing.value) : 0) + 1;
        this.memoryStore.set(key, { value: String(nextVal), expiry: existing?.expiry });
        return nextVal;
      },
      eval: async (script: string, config: { keys: string[]; arguments: string[] }) => {
        // 1. Atomic fixed-window rate limiter script
        if (script.includes('RATE_LIMIT_INCR')) {
          const key = config.keys[0];
          const windowMs = Number(config.arguments[0]);
          const existing = this.getMemoryItem(key);
          const count = (existing ? Number(existing.value) : 0) + 1;
          const expiry = existing?.expiry ?? Date.now() + windowMs;
          this.memoryStore.set(key, { value: String(count), expiry });
          const remainingMs = Math.max(0, expiry - Date.now());
          return [count, remainingMs];
        }

        // 2. Atomic conditional room save with lock + monotonic fencing token
        if (script.includes('SAVE_ROOM_FENCED')) {
          const [lockKey, roomKey, fenceKey] = config.keys;
          const [lockToken, payload, ttlSecondsStr, myFenceStr] = config.arguments;
          const lockItem = this.getMemoryItem(lockKey);
          if (!lockItem || lockItem.value !== lockToken) {
            return 0;
          }
          const fenceItem = this.getMemoryItem(fenceKey);
          const currentFence = fenceItem ? Number(fenceItem.value) : 0;
          const myFence = Number(myFenceStr);
          if (myFence < currentFence) {
            return -1;
          }
          const expiry = Date.now() + Number(ttlSecondsStr) * 1000;
          this.memoryStore.set(roomKey, { value: payload, expiry });
          this.memoryStore.set(fenceKey, { value: String(myFence), expiry });
          return 1;
        }

        // 3. Atomic conditional room delete with lock + fencing token
        if (script.includes('DELETE_ROOM_FENCED')) {
          const [lockKey, roomKey, fenceKey] = config.keys;
          const [lockToken, myFenceStr] = config.arguments;
          const lockItem = this.getMemoryItem(lockKey);
          if (!lockItem || lockItem.value !== lockToken) {
            return 0;
          }
          const fenceItem = this.getMemoryItem(fenceKey);
          const currentFence = fenceItem ? Number(fenceItem.value) : 0;
          const myFence = Number(myFenceStr);
          if (myFence < currentFence) {
            return -1;
          }
          this.memoryStore.delete(roomKey);
          this.memoryStore.delete(fenceKey);
          return 1;
        }

        // 4. Lock renew (pexpire) or release (del)
        const key = config.keys[0];
        const token = config.arguments[0];
        const existing = this.getMemoryItem(key);
        if (!existing || existing.value !== token) {
          return 0;
        }
        if (script.includes('pexpire')) {
          const ttlMs = Number(config.arguments[1]);
          this.memoryStore.set(key, { value: token, expiry: Date.now() + ttlMs });
          return 1;
        }
        this.memoryStore.delete(key);
        return 1;
      },
    };
  }

  /**
   * Test helper to inject a custom/failing lock client for lock failure regression tests.
   */
  setLockClientOverride(client: LockClient | null): void {
    this.customLockClientOverride = client;
  }

  clearMemoryStore(): void {
    this.memoryStore.clear();
    this.memorySortedSets.clear();
  }
}

export default new RedisService();
