import type { Server } from 'socket.io';
import redisService from '../config/redis';
import { RoomService } from './room.service';
import { RuleService } from './rule.service';
import { CardService } from './card.service';
import { RoomLockService } from './lock.service';
import { TimerService } from './timer.service';
import { SessionAuthService } from './session-auth.service';
import { GameBroadcaster } from './game-broadcaster.service';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import type { Card, GameEvent, GameRoom, ServerPlayer } from '../types/game.types';

export const DEFAULT_REVERT_TIMEOUT_MS = 5000;
export const DEFAULT_CHALLENGE_TIMEOUT_MS = 8000;
export const BLUNDER_DEADLINES_KEY = 'blunder:deadlines';

export class BlunderService {
  private static sweepInterval: NodeJS.Timeout | null = null;
  private static sweepInFlight = false;

  /**
   * Record a durable blunder deadline in Redis ZSET so expiration survives backend restarts.
   */
  static async persistDeadline(roomId: string, expiresAtMs: number): Promise<void> {
    await redisService.zAdd(BLUNDER_DEADLINES_KEY, expiresAtMs, roomId);
    metrics.inc('blunders_scheduled_total');
  }

  /**
   * Remove a room's durable blunder deadline from Redis ZSET and cancel any local timer.
   */
  static async clearDeadline(roomId: string): Promise<void> {
    TimerService.clearRoomTimers(roomId);
    try {
      await redisService.zRem(BLUNDER_DEADLINES_KEY, roomId);
    } catch (error) {
      logger.warn('Failed to clear durable blunder deadline', {
        roomId,
        error: error instanceof Error ? error : String(error),
      });
    }
  }

  /**
   * Recover durable blunder deadlines from Redis after a restart (or sweep due entries).
   * - Already-expired deadlines are resolved idempotently under room lock.
   * - Future deadlines get local timers scheduled for prompt execution.
   */
  static async recoverDeadlines(io?: Server): Promise<{
    recoveredDue: number;
    rescheduledFuture: number;
  }> {
    const entries = await redisService.zRangeByScoreWithScores(
      BLUNDER_DEADLINES_KEY,
      '-inf',
      '+inf'
    );
    const now = Date.now();
    let recoveredDue = 0;
    let rescheduledFuture = 0;

    for (const entry of entries) {
      const roomId = entry.value;
      const expiresAt = entry.score;

      if (expiresAt <= now) {
        try {
          const result = await this.handleBlunderTimeout(roomId, io);
          if (result.resolved) {
            recoveredDue += 1;
            metrics.inc('blunders_recovered_total');
          }
        } catch (error) {
          logger.warn('Error recovering due blunder deadline', {
            roomId,
            error: error instanceof Error ? error : String(error),
          });
        }
      } else {
        const delayMs = Math.max(25, expiresAt - now + 25);
        TimerService.setTimer(`blunder:${roomId}`, delayMs, async () => {
          await BlunderService.handleBlunderTimeout(roomId, io);
        });
        rescheduledFuture += 1;
      }
    }

    if (recoveredDue > 0 || rescheduledFuture > 0) {
      logger.info('Recovered durable blunder deadlines', {
        recoveredDue,
        rescheduledFuture,
      });
    }

    return { recoveredDue, rescheduledFuture };
  }

  /**
   * Process any due blunder deadlines (called periodically by the background sweeper).
   */
  static async sweepDueDeadlines(io?: Server): Promise<number> {
    if (this.sweepInFlight) return 0;
    this.sweepInFlight = true;
    let resolvedCount = 0;

    try {
      const dueEntries = await redisService.zRangeByScoreWithScores(
        BLUNDER_DEADLINES_KEY,
        '-inf',
        Date.now()
      );

      for (const entry of dueEntries) {
        try {
          const result = await this.handleBlunderTimeout(entry.value, io);
          if (result.resolved) {
            resolvedCount += 1;
          }
        } catch (error) {
          logger.warn('Error processing due blunder deadline during sweep', {
            roomId: entry.value,
            error: error instanceof Error ? error : String(error),
          });
        }
      }
    } catch (error) {
      logger.warn('Blunder deadline sweep failed', {
        error: error instanceof Error ? error : String(error),
      });
    } finally {
      this.sweepInFlight = false;
    }

    return resolvedCount;
  }

  /**
   * Start durable deadline recovery & periodic sweeper on backend boot.
   */
  static startRecoverySweeper(io?: Server, intervalMs = 1000): void {
    this.stopRecoverySweeper();

    void this.recoverDeadlines(io).catch((error) => {
      logger.error('Initial blunder deadline recovery failed', {
        error: error instanceof Error ? error : String(error),
      });
    });

    this.sweepInterval = setInterval(() => {
      void this.sweepDueDeadlines(io);
    }, intervalMs);

    if (typeof this.sweepInterval.unref === 'function') {
      this.sweepInterval.unref();
    }
  }

  static stopRecoverySweeper(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  static async getPendingDeadlineCount(): Promise<number> {
    try {
      const entries = await redisService.zRangeByScoreWithScores(
        BLUNDER_DEADLINES_KEY,
        '-inf',
        '+inf'
      );
      return entries.length;
    } catch {
      return 0;
    }
  }

  /**
   * Record a blunder in room state (caller MUST hold room lock) and schedule a durable deadline.
   */
  static async registerBlunderUnlocked(
    room: GameRoom,
    player: ServerPlayer,
    cards: Card[],
    reason: string,
    io?: Server,
    timeouts?: { revertTimeoutMs?: number; challengeTimeoutMs?: number }
  ): Promise<{ events: GameEvent[]; room: GameRoom }> {
    const ruleConfig = RuleService.mergeConfig(room.ruleConfig);

    // Move blundered cards out of player's hand into escrow so no duplication can ever occur
    for (const card of cards) {
      const cardIdx = player.cards.findIndex((c) => c.id === card.id);
      if (cardIdx !== -1) {
        player.cards.splice(cardIdx, 1);
      }
    }

    const revertTimeoutMs = timeouts?.revertTimeoutMs ?? DEFAULT_REVERT_TIMEOUT_MS;
    const challengeTimeoutMs = timeouts?.challengeTimeoutMs ?? DEFAULT_CHALLENGE_TIMEOUT_MS;
    const now = Date.now();
    const expiresAt = now + challengeTimeoutMs;

    room.blunderState = {
      active: true,
      playerId: player.id,
      cards,
      reason,
      penalty: ruleConfig.illegalTurnPenalty,
      timestamp: now,
      revertTimeoutMs,
      challengeTimeoutMs,
    };

    await RoomService.saveRoom(room);
    await this.persistDeadline(room.roomId, expiresAt);

    // Local fast-path timer paired with the Redis durable deadline
    if (io) {
      TimerService.setTimer(`blunder:${room.roomId}`, challengeTimeoutMs + 25, async () => {
        await BlunderService.handleBlunderTimeout(room.roomId, io);
      });
    }

    const events: GameEvent[] = [
      {
        type: 'invalid-move',
        payload: {
          playerId: player.id,
          reason,
          canBeChallenged: true,
          cards,
          revertTimeoutMs,
          timeoutMs: challengeTimeoutMs,
        },
      },
    ];

    return { events, room };
  }

  /**
   * Revert an active blunder within the revert window.
   */
  static async revertBlunder(
    roomId: string,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ): Promise<{ success: boolean; error?: string; events: GameEvent[]; room?: GameRoom }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) return { success: false, error: 'Room not found', events: [] };

      if (!room.gameStarted || room.gameOver) {
        return { success: false, error: 'Game is not in progress', events: [] };
      }

      const player = SessionAuthService.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { success: false, error: 'Unauthorized', events: [] };

      if (
        !room.blunderState ||
        !room.blunderState.active ||
        room.blunderState.playerId !== player.id
      ) {
        return { success: false, error: 'No active blunder to revert', events: [] };
      }

      const timeoutMs = room.blunderState.revertTimeoutMs || DEFAULT_REVERT_TIMEOUT_MS;
      if (Date.now() - room.blunderState.timestamp > timeoutMs) {
        return { success: false, error: 'Revert window has expired', events: [] };
      }

      // Return escrowed cards safely to player hand
      player.cards.push(...room.blunderState.cards);
      room.blunderState = undefined;

      await RoomService.saveRoom(room);
      await this.clearDeadline(roomId);
      metrics.inc('blunders_reverted_total');

      const events: GameEvent[] = [
        {
          type: 'blunder-reverted',
          payload: {
            playerId: player.id,
            message: 'Move reverted successfully',
          },
        },
      ];

      return { success: true, events, room };
    });
  }

  /**
   * Challenge an opponent's active blunder by calling Crazy.
   */
  static async callCrazy(
    roomId: string,
    socketId: string,
    callerId?: string,
    callerToken?: string
  ): Promise<{ success: boolean; error?: string; events: GameEvent[]; room?: GameRoom }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) return { success: false, error: 'Room not found', events: [] };

      if (!room.gameStarted || room.gameOver) {
        return { success: false, error: 'Game is not in progress', events: [] };
      }

      const caller = SessionAuthService.authenticatePlayer(room, socketId, callerId, callerToken);
      if (!caller) return { success: false, error: 'Unauthorized', events: [] };

      // Only active players still in the game can challenge
      if (!room.players.some((p) => p.id === caller.id)) {
        return { success: false, error: 'Finished players cannot call crazy', events: [] };
      }

      if (!room.blunderState || !room.blunderState.active) {
        return { success: false, error: 'No active blunder to challenge', events: [] };
      }

      if (caller.id === room.blunderState.playerId) {
        return { success: false, error: 'Cannot call crazy on your own blunder', events: [] };
      }

      const timeoutMs = room.blunderState.challengeTimeoutMs || DEFAULT_CHALLENGE_TIMEOUT_MS;
      if (Date.now() - room.blunderState.timestamp > timeoutMs) {
        return { success: false, error: 'Challenge window has expired', events: [] };
      }

      const blunderPlayer = room.players.find((p) => p.id === room.blunderState!.playerId);
      if (!blunderPlayer) {
        room.blunderState = undefined;
        await RoomService.saveRoom(room);
        await this.clearDeadline(roomId);
        return { success: false, error: 'Blunder player not found', events: [] };
      }

      // Return the escrowed blunder cards to the player
      blunderPlayer.cards.push(...room.blunderState.cards);

      // Draw actual penalty cards
      const requestedPenalty = room.blunderState.penalty || 2;
      const penaltyCards = CardService.drawCards(room, requestedPenalty);
      blunderPlayer.cards.push(...penaltyCards);
      const actualPenalty = penaltyCards.length;

      // Turn remains with blunder player per Crazy rules
      room.currentTurn = blunderPlayer.id;
      room.blunderState = undefined;

      await RoomService.saveRoom(room);
      await this.clearDeadline(roomId);
      metrics.inc('blunders_challenged_total');

      const events: GameEvent[] = [
        {
          type: 'crazy-called',
          payload: {
            success: true,
            callerId: caller.id,
            targetId: blunderPlayer.id,
            penalty: actualPenalty,
          },
        },
        {
          type: 'cards_drawn',
          playerId: blunderPlayer.id,
          amount: actualPenalty,
        },
      ];

      return { success: true, events, room };
    });
  }

  /**
   * Idempotent, room-locked, server-controlled blunder expiration handler.
   * Strictly enforces that the challenge window has genuinely expired before resolving.
   */
  static async handleBlunderTimeout(
    roomId: string,
    io?: Server
  ): Promise<{ resolved: boolean; error?: string; events: GameEvent[]; room?: GameRoom }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room || !room.blunderState || !room.blunderState.active) {
        // Idempotent cleanup of any stale deadline entry in Redis
        await this.clearDeadline(roomId);
        return { resolved: false, error: 'No active blunder', events: [] };
      }

      const challengeTimeoutMs =
        room.blunderState.challengeTimeoutMs || DEFAULT_CHALLENGE_TIMEOUT_MS;
      const elapsed = Date.now() - room.blunderState.timestamp;

      // Strictly enforce timeout expiration inside the service
      if (elapsed < challengeTimeoutMs) {
        return {
          resolved: false,
          error: 'Blunder challenge window has not expired yet',
          events: [],
        };
      }

      const blunderPlayer = room.players.find((p) => p.id === room.blunderState!.playerId);
      if (!blunderPlayer) {
        room.blunderState = undefined;
        await RoomService.saveRoom(room);
        await this.clearDeadline(roomId);
        return { resolved: false, error: 'Blunder player not found', events: [] };
      }

      // Return escrowed cards to hand
      blunderPlayer.cards.push(...room.blunderState.cards);

      // Draw actual penalty cards
      const requestedPenalty = room.blunderState.penalty || 2;
      const penaltyCards = CardService.drawCards(room, requestedPenalty);
      blunderPlayer.cards.push(...penaltyCards);
      const actualPenalty = penaltyCards.length;

      // Advance turn to next active player
      const currentIndex = room.players.findIndex((p) => p.id === blunderPlayer.id);
      const direction = room.turnDirection === 'clockwise' ? 1 : -1;
      const nextIndex = (currentIndex + direction + room.players.length) % room.players.length;
      room.currentTurn = room.players[nextIndex].id;
      room.drawCount = 0;
      room.blunderState = undefined;

      await RoomService.saveRoom(room);
      await this.clearDeadline(roomId);
      metrics.inc('blunders_resolved_timeout_total');

      const events: GameEvent[] = [
        {
          type: 'blunder-timeout',
          payload: {
            playerId: blunderPlayer.id,
            penalty: actualPenalty,
            message: 'Blunder not reverted - penalty applied',
          },
        },
        {
          type: 'cards_drawn',
          playerId: blunderPlayer.id,
          amount: actualPenalty,
        },
      ];

      if (io) {
        events.forEach((e) => io.to(room.roomId).emit('game-event', e));
        GameBroadcaster.broadcastGameUpdate(room, io);
      }

      return { resolved: true, events, room };
    });
  }
}
