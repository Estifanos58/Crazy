import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private connectAttempts: number = 0;
  private readonly maxConnectAttempts: number = 5;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        tls: redisUrl.startsWith('rediss://'),
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return new Error('Max reconnection attempts reached');
          }
          return retries * 1000;
        }
      }
    });

    this.client.on('error', (err: unknown) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis Connected to Upstash');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis Ready');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Simple retry with linear backoff, max 5 attempts
    while (!this.isConnected && this.connectAttempts < this.maxConnectAttempts) {
      try {
        this.connectAttempts += 1;
        console.log(`🔄 Connecting to Redis (attempt ${this.connectAttempts}/${this.maxConnectAttempts})...`);
        await this.client.connect();
        this.isConnected = true;
        console.log('✅ Redis Connected');
        break;
      } catch (error) {
        console.error(`❌ Redis connection attempt ${this.connectAttempts} failed:`, error);

        if (this.connectAttempts >= this.maxConnectAttempts) {
          throw new Error('Failed to connect to Redis after 5 attempts');
        }

        // Wait a bit before retrying (e.g., 1s * attempt number)
        const delayMs = this.connectAttempts * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
      await this.client.setEx(key, expirySeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  getClient(): RedisClientType {
    return this.client;
  }
}

export default new RedisService();
