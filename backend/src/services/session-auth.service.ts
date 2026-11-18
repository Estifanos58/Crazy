import crypto from 'node:crypto';
import type { GameRoom, ServerPlayer } from '../types/game.types';

export class SessionAuthService {
  /**
   * Constant-time token verification to prevent timing side-channel attacks.
   */
  static verifyToken(expectedToken: string, providedToken: string): boolean {
    if (!expectedToken || !providedToken) {
      return false;
    }

    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    const providedBuf = Buffer.from(providedToken, 'utf8');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Find a player across active and finished players by ID + secret token.
   */
  static findPlayerByCredentials(
    room: GameRoom,
    playerId: string,
    playerToken: string
  ): ServerPlayer | null {
    const allPlayers = [...room.players, ...(room.finishedPlayers || [])];
    const candidate = allPlayers.find((p) => p.id === playerId);
    if (!candidate) {
      return null;
    }

    return this.verifyToken(candidate.token, playerToken) ? candidate : null;
  }

  /**
   * Authenticate a player in a room.
   * - If playerId or playerToken is provided, credentials MUST strictly match (never falls back to socketId).
   * - If neither credential is provided, matches only by active bound socketId.
   */
  static authenticatePlayer(
    room: GameRoom,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ): ServerPlayer | null {
    if (playerId !== undefined || playerToken !== undefined) {
      if (!playerId || !playerToken) {
        return null;
      }
      return this.findPlayerByCredentials(room, playerId, playerToken);
    }

    if (!socketId) {
      return null;
    }

    const allPlayers = [...room.players, ...(room.finishedPlayers || [])];
    return allPlayers.find((p) => p.socketId === socketId) ?? null;
  }
}
