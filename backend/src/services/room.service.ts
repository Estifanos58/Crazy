import crypto from 'node:crypto';
import redisService from '../config/redis';
import type {
  GameRoom,
  JoinRoomData,
  Player,
  RankedPlayer,
  ServerPlayer,
  StartGameData,
} from '../types/game.types';
import { CardService } from './card.service';
import { RuleService } from './rule.service';
import { RoomLockService } from './lock.service';
import { SessionAuthService } from './session-auth.service';
import { GameBroadcaster } from './game-broadcaster.service';
import { RulePresets, RuleValidator } from '../utils/rule-builder';

function generateRoomId(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function generatePlayerId(): string {
  return `p_${crypto.randomBytes(9).toString('hex')}`;
}

function generatePlayerToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export interface JoinRoomResult {
  room: GameRoom;
  playerId: string;
  playerToken: string;
}

export class RoomService {
  private static ROOM_PREFIX = 'room:';
  private static ROOM_EXPIRY = 3600 * 4; // 4 hours
  private static MAX_PLAYERS = 8;

  static async createRoom(
    creatorSocketId: string,
    username: string,
    avatar: string
  ): Promise<JoinRoomResult> {
    let roomId = generateRoomId();
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await this.roomExists(roomId);
      if (!taken) break;
      roomId = generateRoomId();
    }

    const playerId = generatePlayerId();
    const playerToken = generatePlayerToken();
    const cleanUsername = username.trim();

    const creator: ServerPlayer = {
      id: playerId,
      token: playerToken,
      socketId: creatorSocketId,
      username: cleanUsername,
      avatar: avatar.trim(),
      cards: [],
      isCreator: true,
      connected: true,
    };

    const room: GameRoom = {
      roomId,
      creatorId: playerId,
      players: [creator],
      finishedPlayers: [],
      gameStarted: false,
      gameOver: false,
      deck: [],
      createdAt: Date.now(),
    };

    await this.saveRoom(room);
    return { room, playerId, playerToken };
  }

  /**
   * Public locked joinRoom
   */
  static async joinRoom(socketId: string, data: JoinRoomData): Promise<JoinRoomResult | null> {
    return await RoomLockService.runWithLock(data.roomId, async () => {
      return await this.joinRoomUnlocked(socketId, data);
    });
  }

  /**
   * Internal unlocked joinRoom (caller MUST hold room lock)
   */
  static async joinRoomUnlocked(
    socketId: string,
    data: JoinRoomData
  ): Promise<JoinRoomResult | null> {
    const room = await this.getRoom(data.roomId);

    if (!room) {
      return null;
    }

    // Lifecycle check: joining is only allowed in lobby state
    if (room.gameStarted || room.gameOver) {
      throw new Error('Game already started');
    }

    // Check if player with same socket already in room
    const existing = room.players.find((p) => p.socketId === socketId);
    if (existing) {
      return { room, playerId: existing.id, playerToken: existing.token };
    }

    if (room.players.length >= this.MAX_PLAYERS) {
      throw new Error(`Room is full (maximum ${this.MAX_PLAYERS} players)`);
    }

    const cleanUsername = data.username.trim();
    const usernameTaken = room.players.some(
      (p) => p.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (usernameTaken) {
      throw new Error('Username already taken in this room');
    }

    const playerId = generatePlayerId();
    const playerToken = generatePlayerToken();

    const newPlayer: ServerPlayer = {
      id: playerId,
      token: playerToken,
      socketId,
      username: cleanUsername,
      avatar: data.avatar.trim(),
      cards: [],
      isCreator: false,
      connected: true,
    };

    room.players.push(newPlayer);
    await this.saveRoom(room);

    return { room, playerId, playerToken };
  }

  /**
   * Public locked startGame with full host authorization and lifecycle validation
   */
  static async startGameAuthorized(
    socketId: string,
    data: StartGameData & { playerId?: string; playerToken?: string }
  ): Promise<{ room: GameRoom; starter: ServerPlayer }> {
    return await RoomLockService.runWithLock(data.roomId, async () => {
      const room = await this.getRoom(data.roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const player = SessionAuthService.authenticatePlayer(
        room,
        socketId,
        data.playerId,
        data.playerToken
      );
      if (!player) {
        throw new Error('Unauthorized');
      }

      if (room.creatorId !== player.id) {
        throw new Error('Only room creator can start game');
      }

      if (room.gameStarted) {
        throw new Error('Game already started');
      }

      if (room.gameOver) {
        throw new Error('Game has finished; use play-again to start a new round');
      }

      if (room.players.length < 2) {
        throw new Error('At least 2 players are required to start the game');
      }

      const started = await this.startGameUnlocked(room, data);
      return { room: started, starter: player };
    });
  }

  /**
   * Backwards-compatible locked startGame
   */
  static async startGame(data: StartGameData): Promise<GameRoom | null> {
    return await RoomLockService.runWithLock(data.roomId, async () => {
      const room = await this.getRoom(data.roomId);
      if (!room) {
        return null;
      }
      if (room.gameStarted && !room.gameOver) {
        throw new Error('Game already started');
      }
      if (room.players.length < 2) {
        throw new Error('At least 2 players are required to start the game');
      }
      return await this.startGameUnlocked(room, data);
    });
  }

  /**
   * Internal unlocked startGame (caller MUST hold room lock)
   */
  static async startGameUnlocked(room: GameRoom, data: StartGameData): Promise<GameRoom> {
    if (room.players.length < 2) {
      throw new Error('At least 2 players are required to start the game');
    }

    const cardsCount = Math.floor(data.cardsPerPlayer || 7);
    if (cardsCount < 1 || cardsCount > 15) {
      throw new Error('Cards per player must be between 1 and 15');
    }

    const requiredCards = cardsCount * room.players.length + 1;
    if (requiredCards > 52) {
      const maxForPlayerCount = Math.floor(51 / room.players.length);
      throw new Error(
        `Too many cards requested for ${room.players.length} players (maximum ${maxForPlayerCount} cards per player)`
      );
    }

    if (data.ruleConfig) {
      const validation = RuleValidator.validate(data.ruleConfig);
      if (!validation.valid) {
        throw new Error(`Invalid custom rules: ${validation.errors[0]}`);
      }
    }

    const presetConfig = data.rulePreset ? RulePresets.getByName(data.rulePreset) : undefined;
    const baseConfig = RuleService.mergeConfig(presetConfig);
    const ruleConfig = data.ruleConfig
      ? {
          punishment: { ...baseConfig.punishment, ...data.ruleConfig.punishment },
          specialCards: { ...baseConfig.specialCards, ...data.ruleConfig.specialCards },
          crazyChallenge: { ...baseConfig.crazyChallenge, ...data.ruleConfig.crazyChallenge },
          illegalTurnPenalty: data.ruleConfig.illegalTurnPenalty ?? baseConfig.illegalTurnPenalty,
          allowDropAllSameSuit:
            data.ruleConfig.allowDropAllSameSuit ?? baseConfig.allowDropAllSameSuit,
          winOnEmpty: data.ruleConfig.winOnEmpty ?? baseConfig.winOnEmpty,
        }
      : baseConfig;

    const deck = CardService.createDeck();
    const shuffledDeck = CardService.shuffleDeck(deck);

    const { playerHands, remainingDeck } = CardService.dealCards(
      shuffledDeck,
      room.players.length,
      cardsCount
    );

    room.players.forEach((player, index) => {
      player.cards = playerHands[index] || [];
      player.rank = undefined;
      player.finishedAt = undefined;
    });

    room.gameStarted = true;
    room.gameOver = false;
    room.deck = remainingDeck;
    room.pile = [];
    room.currentTurn = room.players[0].id;
    room.currentSuit = undefined;
    room.turnDirection = 'clockwise';
    room.punishmentChain = {
      active: false,
      amount: 0,
      cards: [],
    };
    room.lastSuitChangedBy = undefined;
    room.drawCount = 0;
    room.blunderState = undefined;
    room.finishedPlayers = [];
    room.rules = {
      cardsPerPlayer: cardsCount,
      customRules: data.customRules,
      rulePreset: data.rulePreset,
    };
    room.ruleConfig = ruleConfig;

    await this.saveRoom(room);
    return room;
  }

  static async getRoom(roomId: string): Promise<GameRoom | null> {
    const data = await redisService.get(`${this.ROOM_PREFIX}${roomId}`);
    if (!data) return null;

    try {
      return JSON.parse(data) as GameRoom;
    } catch {
      return null;
    }
  }

  static async saveRoom(room: GameRoom): Promise<void> {
    await redisService.set(
      `${this.ROOM_PREFIX}${room.roomId}`,
      JSON.stringify(room),
      this.ROOM_EXPIRY
    );
  }

  static async deleteRoom(roomId: string): Promise<void> {
    await redisService.delete(`${this.ROOM_PREFIX}${roomId}`);
  }

  static async roomExists(roomId: string): Promise<boolean> {
    return await redisService.exists(`${this.ROOM_PREFIX}${roomId}`);
  }

  /**
   * Rejoin room securely using valid persistent credentials (playerId + playerToken).
   * NEVER allows username-based takeover of an existing player in lobby, active, or finished games!
   */
  static async rejoinRoom(
    socketId: string,
    roomId: string,
    playerId?: string,
    playerToken?: string,
    username?: string,
    avatar?: string
  ): Promise<{ room: GameRoom; player: ServerPlayer; playerId: string; playerToken: string } | null> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      // 1. If credentials are provided, strictly authenticate via persistent playerId + timing-safe playerToken
      if (playerId || playerToken) {
        if (!playerId || !playerToken) {
          throw new Error('Invalid player session credentials');
        }

        const targetPlayer = SessionAuthService.findPlayerByCredentials(room, playerId, playerToken);
        if (!targetPlayer) {
          throw new Error('Invalid player session credentials');
        }

        targetPlayer.socketId = socketId;
        targetPlayer.connected = true;

        await this.saveRoom(room);
        return {
          room,
          player: targetPlayer,
          playerId: targetPlayer.id,
          playerToken: targetPlayer.token,
        };
      }

      // 2. Without credentials: NEVER hijack existing players by username!
      // Only permit joining as a brand-new player if room is still in lobby state.
      if (!room.gameStarted && !room.gameOver && username && avatar) {
        const joinResult = await this.joinRoomUnlocked(socketId, { roomId, username, avatar });
        if (!joinResult) return null;
        const joinedPlayer = joinResult.room.players.find((p) => p.id === joinResult.playerId)!;
        return {
          room: joinResult.room,
          player: joinedPlayer,
          playerId: joinResult.playerId,
          playerToken: joinResult.playerToken,
        };
      }

      throw new Error('Valid player credentials are required to reconnect');
    });
  }

  /**
   * Mark a player as disconnected under room lock (preserving their state for reconnection).
   */
  static async markPlayerDisconnected(
    roomId: string,
    socketId: string,
    playerId?: string
  ): Promise<GameRoom | null> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      const allPlayers = [...room.players, ...(room.finishedPlayers || [])];
      const player = allPlayers.find(
        (p) => (playerId && p.id === playerId && p.socketId === socketId) || p.socketId === socketId
      );

      if (!player) return null;

      player.connected = false;
      await this.saveRoom(room);
      return room;
    });
  }

  /**
   * Reset game state and restore finished players into room.players (caller MUST hold room lock).
   */
  static async resetGameUnlocked(room: GameRoom): Promise<GameRoom> {
    const allPlayers: ServerPlayer[] = [...room.players, ...(room.finishedPlayers || [])];

    const resetRoom: GameRoom = {
      ...room,
      gameStarted: false,
      gameOver: false,
      deck: [],
      pile: undefined,
      currentTurn: undefined,
      currentSuit: undefined,
      turnDirection: 'clockwise',
      punishmentChain: {
        active: false,
        amount: 0,
        cards: [],
      },
      drawCount: 0,
      blunderState: undefined,
      lastSuitChangedBy: undefined,
      finishedPlayers: [],
      players: allPlayers.map((player) => ({
        ...player,
        cards: [],
        rank: undefined,
        finishedAt: undefined,
      })),
    };

    await this.saveRoom(resetRoom);
    return resetRoom;
  }

  /**
   * Locked resetGame helper
   */
  static async resetGame(room: GameRoom): Promise<GameRoom> {
    return await RoomLockService.runWithLock(room.roomId, async () => {
      const latest = (await this.getRoom(room.roomId)) || room;
      return await this.resetGameUnlocked(latest);
    });
  }

  static sanitizePlayers(players: ServerPlayer[]): Player[] {
    return GameBroadcaster.sanitizePlayers(players);
  }

  static sanitizeRankedPlayers(players: ServerPlayer[]): RankedPlayer[] {
    return GameBroadcaster.sanitizeRankedPlayers(players);
  }
}
