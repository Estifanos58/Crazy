import { logger } from '../utils/logger';

export class TimerService {
  private static activeTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Set a timer for a specific room action.
   */
  static setTimer(key: string, delayMs: number, callback: () => void | Promise<void>): void {
    this.clearTimer(key);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(key);
      try {
        await callback();
      } catch (error) {
        logger.error('Error in timer callback', {
          timerKey: key,
          error: error instanceof Error ? error : String(error),
        });
      }
    }, delayMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    this.activeTimers.set(key, timer);
  }

  /**
   * Clear an active timer.
   */
  static clearTimer(key: string): void {
    const existing = this.activeTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(key);
    }
  }

  /**
   * Clear all timers associated with a room.
   */
  static clearRoomTimers(roomId: string): void {
    const suffix = `:${roomId}`;
    for (const [key, timer] of this.activeTimers.entries()) {
      if (key.endsWith(suffix) || key.includes(`${suffix}:`)) {
        clearTimeout(timer);
        this.activeTimers.delete(key);
      }
    }
  }

  /**
   * Clear all active timers (used on graceful shutdown or test cleanup).
   */
  static clearAllTimers(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}
