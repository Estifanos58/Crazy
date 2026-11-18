import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface LockClient {
  set(key: string, value: string, options?: { NX?: boolean; PX?: number }): Promise<string | null>;
  eval(script: string, config: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private mode: 'redis' | 'memory' = 'memory';
  private connectAttempts = 0;
  private readonly maxConnectAttempts = 5;
  private memoryStore: Map<string, { value: string; expiry?: number }> = new Map();
  private customLockClientOverride: LockClient | null = null;

  constructor() {
    const shouldUseMemoryOnly =
      process.env.REDIS_USE_MEMORY === 'true' ||
      (process.env.NODE_ENV === 'test' && !process.env.REDIS_URL);

    if (shouldUseMemoryOnly) {
      this.mode = 'memory';
      this.client = null;
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
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
      logger.error('Failed to initialize Redis client', { error: err instanceof Error ? err : String(err) });
      this.client = null;
    }
  }

  async connect(redisUrlOverride?: string): Promise<void> {
    if (redisUrlOverride) {
      await this.disconnect();
      this.connectAttempts = 0;
      this.initClient(redisUrlOverride);
    }

    if (this.isConnected) {
      return;
    }

    if (!this.client) {
      if (this.isRedisRequired()) {
        throw new Error('Redis is required in production but no Redis client could be initialized');
      }
      this.mode = 'memory';
      return;
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
          if (this.isRedisRequired()) {
            throw new Error('Failed to connect to Redis after maximum attempts');
          }
          logger.warn('Redis unavailable; falling back to explicit in-memory store for non-production mode');
          this.mode = 'memory';
          return;
        }
        const delayMs = Math.min(this.connectAttempts * 500, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private isRedisRequired(): boolean {
    if (process.env.REDIS_REQUIRED === 'true') return true;
    if (process.env.REDIS_REQUIRED === 'false') return false;
    return process.env.NODE_ENV === 'production';
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
      return !this.isRedisRequired();
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
    return !this.isRedisRequired();
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

  async get(key: string): Promise<string | null> {
    if (this.mode === 'redis') {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis is disconnected');
      }
      return await this.client.get(key);
    }

    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
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

    const item = this.memoryStore.get(key);
    if (!item) return false;
    if (item.expiry && Date.now() > item.expiry) {
      this.memoryStore.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Returns the lock client. In Redis mode, NEVER silently falls back to memory if Redis is down.
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

    // Explicit in-memory atomic lock client (dev/test without Redis)
    return {
      set: async (key: string, token: string, options?: { NX?: boolean; PX?: number }) => {
        const existing = this.memoryStore.get(key);
        if (options?.NX && existing && (!existing.expiry || existing.expiry > Date.now())) {
          return null;
        }
        const expiry = options?.PX ? Date.now() + options.PX : undefined;
        this.memoryStore.set(key, { value: token, expiry });
        return 'OK';
      },
      eval: async (script: string, config: { keys: string[]; arguments: string[] }) => {
        const key = config.keys[0];
        const token = config.arguments[0];
        const existing = this.memoryStore.get(key);
        if (!existing || (existing.expiry && existing.expiry <= Date.now())) {
          this.memoryStore.delete(key);
          return 0;
        }
        if (existing.value !== token) {
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
  }
}

export default new RedisService();
