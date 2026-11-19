import type { Socket } from 'socket.io';
import redisService from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterMs: number;
}

const RATE_LIMIT_INCR_LUA = `
  -- RATE_LIMIT_INCR
  local current = redis.call("incr", KEYS[1])
  if current == 1 then
    redis.call("pexpire", KEYS[1], tonumber(ARGV[1]))
  end
  local ttl = redis.call("pttl", KEYS[1])
  if ttl < 0 then
    redis.call("pexpire", KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
  end
  return {current, ttl}
`;

export const RATE_LIMITS: Record<string, RateLimitRule> = {
  'connect': { limit: 40, windowMs: 60_000 },
  'create-room': { limit: 10, windowMs: 60_000 },
  'join-room': { limit: 20, windowMs: 60_000 },
  'get-room': { limit: 15, windowMs: 60_000 },
  'get-room-miss': { limit: 8, windowMs: 60_000 },
  'rejoin-room': { limit: 25, windowMs: 60_000 },
  'rejoin-auth-fail': { limit: 10, windowMs: 300_000 },
  'start-game': { limit: 15, windowMs: 60_000 },
  'play-card': { limit: 60, windowMs: 10_000 },
  'take-punishment': { limit: 40, windowMs: 10_000 },
  'call-crazy': { limit: 20, windowMs: 10_000 },
  'revert-blunder': { limit: 20, windowMs: 10_000 },
  'no-revert': { limit: 10, windowMs: 60_000 },
  'play-again': { limit: 15, windowMs: 60_000 },
  'leave-game': { limit: 20, windowMs: 60_000 },
  'get-game-state': { limit: 30, windowMs: 10_000 },
};

export class RateLimitService {
  private static KEY_PREFIX = 'rl:';
  private static activeConnectionsByIp = new Map<string, number>();

  /**
   * Extract normalized client IP address from Socket.IO handshake.
   * Honors X-Forwarded-For ONLY when TRUST_PROXY=true.
   */
  static getClientIp(socket: Socket): string {
    if (process.env.TRUST_PROXY === 'true') {
      const forwarded = socket.handshake.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
      }
      if (Array.isArray(forwarded) && forwarded[0]) {
        return forwarded[0].trim();
      }
    }
    return socket.handshake.address || 'unknown';
  }

  static getMaxConnectionsPerIp(): number {
    const parsed = Number(process.env.MAX_CONNECTIONS_PER_IP);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    return 25;
  }

  static registerConnection(ip: string): { allowed: boolean; current: number; max: number } {
    const max = this.getMaxConnectionsPerIp();
    const current = this.activeConnectionsByIp.get(ip) || 0;
    if (current >= max) {
      metrics.inc('socket_connections_rejected_total');
      logger.warn('Rejected socket connection: max concurrent connections per IP reached', {
        ip,
        current,
        max,
      });
      return { allowed: false, current, max };
    }
    const next = current + 1;
    this.activeConnectionsByIp.set(ip, next);
    return { allowed: true, current: next, max };
  }

  static releaseConnection(ip: string): void {
    const current = this.activeConnectionsByIp.get(ip) || 0;
    if (current <= 1) {
      this.activeConnectionsByIp.delete(ip);
    } else {
      this.activeConnectionsByIp.set(ip, current - 1);
    }
  }

  static getActiveConnectionCountForIp(ip: string): number {
    return this.activeConnectionsByIp.get(ip) || 0;
  }

  static resetConnectionCounts(): void {
    this.activeConnectionsByIp.clear();
  }

  /**
   * Consume one token from the rate limit bucket for `action` + `identifier`.
   * Fails closed on abuse; fails open with warning if Redis is momentarily unavailable on non-auth checks.
   */
  static async consume(
    action: string,
    identifier: string,
    overrideRule?: RateLimitRule
  ): Promise<RateLimitResult> {
    const rule = overrideRule || RATE_LIMITS[action] || { limit: 60, windowMs: 60_000 };
    const key = `${this.KEY_PREFIX}${action}:${identifier}`;

    try {
      const client = redisService.getClient();
      const raw = (await client.eval(RATE_LIMIT_INCR_LUA, {
        keys: [key],
        arguments: [String(rule.windowMs)],
      })) as [number | string, number | string];

      const count = Number(raw[0]);
      const retryAfterMs = Math.max(0, Number(raw[1]));
      const allowed = count <= rule.limit;

      if (!allowed) {
        metrics.inc('rate_limit_rejected_total');
        logger.warn('Rate limit exceeded', {
          action,
          identifier,
          count,
          limit: rule.limit,
          retryAfterMs,
        });
      }

      return { allowed, count, limit: rule.limit, retryAfterMs };
    } catch (err) {
      logger.warn('Rate limit check failed due to store error', {
        action,
        identifier,
        error: err instanceof Error ? err : String(err),
      });
      return { allowed: false, count: rule.limit + 1, limit: rule.limit, retryAfterMs: 1000 };
    }
  }

  /**
   * Check whether a secondary penalty bucket (like failed room lookups or failed auth) is currently exhausted
   * WITHOUT incrementing it.
   */
  static async isBlocked(
    action: string,
    identifier: string,
    overrideRule?: RateLimitRule
  ): Promise<boolean> {
    const rule = overrideRule || RATE_LIMITS[action];
    if (!rule) return false;
    const key = `${this.KEY_PREFIX}${action}:${identifier}`;
    try {
      const raw = await redisService.get(key);
      if (!raw) return false;
      return Number(raw) >= rule.limit;
    } catch {
      return false;
    }
  }

  /**
   * Convenience wrapper for socket event handlers.
   */
  static async checkSocketEvent(
    socket: Socket,
    action: string,
    scope: 'ip' | 'socket' = 'ip',
    overrideRule?: RateLimitRule
  ): Promise<RateLimitResult> {
    const identifier = scope === 'ip' ? this.getClientIp(socket) : socket.id;
    return await this.consume(action, identifier, overrideRule);
  }
}
