import { customAlphabet } from 'nanoid';
import redisService from '../config/redis';
import type { GameRoom, ServerPlayer, Player, JoinRoomData, StartGameData, RankedPlayer } from '../types/game.types';
import { CardService } from './card.service';
import { RuleService } from './rule.service';

const nanoidRoom = customAlphabet('0123456789', 6);
const nanoidPlayer = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);
const nanoidToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 24);

export interface JoinRoomResult {
  room: GameRoom;
  playerId: string;
  playerToken: string;
}

export class RoomService {
  private static ROOM_PREFIX = 'room:';
  private static ROOM_EXPIRY = 3600 * 4; // 4 hours

  static async createRoom(creatorSocketId: string, username: string, avatar: string): Promise<JoinRoomResult> {
    const roomId = nanoidRoom();
    const playerId = `p_${nanoidPlayer()}`;
    const playerToken = nanoidToken();
    
    const creator: ServerPlayer = {
      id: playerId,
      token: playerToken,
      socketId: creatorSocketId,
      username,
      avatar,
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
      deck: [],
      createdAt: Date.now(),
    };

    await this.saveRoom(room);
    return { room, playerId, playerToken };
  }

  static async joinRoom(socketId: string, data: JoinRoomData): Promise<JoinRoomResult | null> {
    const room = await this.getRoom(data.roomId);
    
    if (!room) {
      return null;
    }

    if (room.gameStarted) {
      throw new Error('Game already started');
    }

    // Check if player with same socket already in room
    const existing = room.players.find(p => p.socketId === socketId);
    if (existing) {
      return { room, playerId: existing.id, playerToken: existing.token };
    }

    // Check duplicate username in room
    const usernameTaken = room.players.some(
      p => p.username.toLowerCase() === data.username.trim().toLowerCase()
    );
    if (usernameTaken) {
      throw new Error('Username already taken in this room');
    }

    const playerId = `p_${nanoidPlayer()}`;
    const playerToken = nanoidToken();

    const newPlayer: ServerPlayer = {
      id: playerId,
      token: playerToken,
      socketId,
      username: data.username.trim(),
      avatar: data.avatar,
      cards: [],
      isCreator: false,
      connected: true,
    };
    
    room.players.push(newPlayer);
    await this.saveRoom(room);

    return { room, playerId, playerToken };
  }

  static async startGame(data: StartGameData): Promise<GameRoom | null> {
    const room = await this.getRoom(data.roomId);
    
    if (!room) {
      return null;
    }

    if (room.gameStarted && !room.gameOver) {
      throw new Error('Game already started');
    }

    // Deal cards
    const deck = CardService.createDeck();
    const shuffledDeck = CardService.shuffleDeck(deck);

    const cardsCount = Math.max(1, Math.min(15, data.cardsPerPlayer || 7));
    const { playerHands, remainingDeck } = CardService.dealCards(
      shuffledDeck,
      room.players.length,
      cardsCount
    );

    // Assign cards to players
    room.players.forEach((player, index) => {
      player.cards = playerHands[index] || [];
      player.rank = undefined;
      player.finishedAt = undefined;
    });

    const ruleConfig = RuleService.mergeConfig(data.ruleConfig);

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
   * Rejoin room securely with credentials or fallback
   */
  static async rejoinRoom(
    socketId: string,
    roomId: string,
    playerId?: string,
    playerToken?: string,
    username?: string,
    avatar?: string
  ): Promise<{ room: GameRoom; player: ServerPlayer; playerId: string; playerToken: string } | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    let targetPlayer: ServerPlayer | undefined;

    // 1. Try finding by persistent playerId and playerToken (secure reconnection)
    if (playerId && playerToken) {
      targetPlayer = room.players.find(p => p.id === playerId && p.token === playerToken);
      if (!targetPlayer && room.finishedPlayers) {
        targetPlayer = room.finishedPlayers.find(p => p.id === playerId && p.token === playerToken);
      }
    }

    // 2. Legacy fallback: find by username if game hasn't started or if token not provided
    if (!targetPlayer && username) {
      targetPlayer = room.players.find(p => p.username === username);
      if (!targetPlayer && room.finishedPlayers) {
        targetPlayer = room.finishedPlayers.find(p => p.username === username);
      }
    }

    if (targetPlayer) {
      // Update socket ID and connection status
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

    // 3. If game has not started, allow new join
    if (!room.gameStarted && username && avatar) {
      const joinResult = await this.joinRoom(socketId, { roomId, username, avatar });
      if (!joinResult) return null;
      const joinedPlayer = joinResult.room.players.find(p => p.id === joinResult.playerId)!;
      return {
        room: joinResult.room,
        player: joinedPlayer,
        playerId: joinResult.playerId,
        playerToken: joinResult.playerToken,
      };
    }

    throw new Error('Cannot join game in progress without valid player session');
  }

  /**
   * Reset game state and restore finished players into room.players
   */
  static async resetGame(room: GameRoom): Promise<GameRoom> {
    // Recombine active and finished players
    const allPlayers: ServerPlayer[] = [
      ...room.players,
      ...(room.finishedPlayers || []),
    ];

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
      players: allPlayers.map(player => ({
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
   * Sanitize room for public distribution (strip tokens and hidden cards)
   */
  static sanitizePlayers(players: ServerPlayer[]): Player[] {
    return players.map(p => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      cardCount: p.cards.length,
      isCreator: p.isCreator,
      rank: p.rank,
      finishedAt: p.finishedAt,
      connected: p.connected,
    }));
  }

  static sanitizeRankedPlayers(players: ServerPlayer[]): RankedPlayer[] {
    return players.map(p => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      rank: p.rank || 0,
      finishedAt: p.finishedAt,
    }));
  }
}
