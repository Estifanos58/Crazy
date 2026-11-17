export class TimerService {
  private static activeTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Set a timer for a specific room action
   */
  static setTimer(key: string, delayMs: number, callback: () => void | Promise<void>): void {
    this.clearTimer(key);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(key);
      try {
        await callback();
      } catch (error) {
        console.error(`Error in timer callback for ${key}:`, error);
      }
    }, delayMs);

    this.activeTimers.set(key, timer);
  }

  /**
   * Clear an active timer
   */
  static clearTimer(key: string): void {
    const existing = this.activeTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(key);
    }
  }

  /**
   * Clear all timers for a room (e.g. on game end or room deletion)
   */
  static clearRoomTimers(roomId: string): void {
    const prefix = `blunder:${roomId}`;
    for (const [key, timer] of this.activeTimers.entries()) {
      if (key.startsWith(prefix) || key.includes(roomId)) {
        clearTimeout(timer);
        this.activeTimers.delete(key);
      }
    }
  }
}
