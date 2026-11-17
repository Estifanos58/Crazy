import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private connectAttempts: number = 0;
  private readonly maxConnectAttempts: number = 5;
  private memoryStore: Map<string, { value: string; expiry?: number }> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Only attempt Redis connection if not in mock/test mode or if REDIS_URL is provided
    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              return new Error('Max reconnection attempts reached');
            }
            return retries * 1000;
          },
        },
      });

      this.client.on('error', (err: unknown) => {
        // Suppress unhandled errors when running offline/in tests
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Redis Client Warning:', (err as Error)?.message || err);
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis Ready');
        this.isConnected = true;
      });
    } catch {
      this.client = null;
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected || !this.client) {
      return;
    }

    while (!this.isConnected && this.connectAttempts < this.maxConnectAttempts) {
      try {
        this.connectAttempts += 1;
        console.log(`🔄 Connecting to Redis (attempt ${this.connectAttempts}/${this.maxConnectAttempts})...`);
        await this.client.connect();
        this.isConnected = true;
        console.log('✅ Redis Connected');
        break;
      } catch (error) {
        console.warn(`⚠️ Redis connection attempt ${this.connectAttempts} failed, using in-memory store fallback`);
        if (this.connectAttempts >= this.maxConnectAttempts) {
          // If Redis is unreachable, don't crash the server: fallback to in-memory store
          console.warn('⚠️ Redis unavailable. Running with in-memory state store.');
          break;
        }
        const delayMs = Math.min(this.connectAttempts * 500, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (expirySeconds) {
          await this.client.setEx(key, expirySeconds, value);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // Fall back to memory
      }
    }

    const expiry = expirySeconds ? Date.now() + expirySeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiry });
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        // Fall back to memory
      }
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
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        // Fall back to memory
      }
    }

    this.memoryStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.isConnected && this.client) {
      try {
        const result = await this.client.exists(key);
        return result === 1;
      } catch {
        // Fall back to memory
      }
    }

    const item = this.memoryStore.get(key);
    if (!item) return false;
    if (item.expiry && Date.now() > item.expiry) {
      this.memoryStore.delete(key);
      return false;
    }
    return true;
  }

  getClient(): any {
    if (this.isConnected && this.client) {
      return this.client;
    }
    // Safe mock client for lock evaluations when in memory fallback mode
    return {
      set: async (key: string, token: string, options?: any) => {
        const existing = this.memoryStore.get(key);
        if (options?.NX && existing && (!existing.expiry || existing.expiry > Date.now())) {
          return null;
        }
        const expiry = options?.PX ? Date.now() + options.PX : undefined;
        this.memoryStore.set(key, { value: token, expiry });
        return 'OK';
      },
      eval: async (_script: string, config: { keys: string[]; arguments: string[] }) => {
        const key = config.keys[0];
        const token = config.arguments[0];
        const existing = this.memoryStore.get(key);
        if (existing?.value === token) {
          this.memoryStore.delete(key);
          return 1;
        }
        return 0;
      },
    };
  }

  clearMemoryStore(): void {
    this.memoryStore.clear();
  }
}

export default new RedisService();
