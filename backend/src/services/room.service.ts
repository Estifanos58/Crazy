import { customAlphabet } from 'nanoid';
import redisService from '../config/redis';
import type { GameRoom, Player, JoinRoomData, StartGameData } from '../types/game.types';
import { CardService } from './card.service';
import { RuleService } from './rule.service';

const nanoid = customAlphabet('0123456789', 6);

export class RoomService {
  private static ROOM_PREFIX = 'room:';
  private static ROOM_EXPIRY = 3600 * 4; // 4 hours

  static async createRoom(creatorId: string, username: string, avatar: string): Promise<GameRoom> {
    const roomId = nanoid();
    
    const creator: Player = {
      id: creatorId,
      username,
      avatar,
      cards: [],
      isCreator: true,
    };

    const room: GameRoom = {
      roomId,
      creatorId,
      players: [creator],
      gameStarted: false,
      deck: [],
      createdAt: Date.now(),
    };

    await this.saveRoom(room);
    return room;
  }

  static async joinRoom(socketId: string, data: JoinRoomData): Promise<GameRoom | null> {
    const room = await this.getRoom(data.roomId);
    
    if (!room) {
      return null;
    }

    if (room.gameStarted) {
      throw new Error('Game already started');
    }

    const playerExists = room.players.some(p => p.id === socketId);
    
    if (!playerExists) {
      const newPlayer: Player = {
        id: socketId,
        username: data.username,
        avatar: data.avatar,
        cards: [],
        isCreator: false,
      };
      
      room.players.push(newPlayer);
      await this.saveRoom(room);
    }

    return room;
  }

  static async startGame(data: StartGameData): Promise<GameRoom | null> {
    const room = await this.getRoom(data.roomId);
    
    if (!room) {
      return null;
    }

    if (room.gameStarted) {
      throw new Error('Game already started');
    }

    // Create and shuffle deck
    const deck = CardService.createDeck();
    const shuffledDeck = CardService.shuffleDeck(deck);

    // Deal cards to players
    const { playerHands, remainingDeck } = CardService.dealCards(
      shuffledDeck,
      room.players.length,
      data.cardsPerPlayer
    );

    // Assign cards to players
    room.players.forEach((player, index) => {
      player.cards = playerHands[index];
    });

    // Initialize rule configuration
    const ruleConfig = RuleService.mergeConfig(data.ruleConfig);

    // Update room state
    room.gameStarted = true;
    room.deck = remainingDeck;
    room.pile = []; // Initialize empty pile
    room.currentTurn = room.players[0].id; // First player starts
    room.currentSuit = undefined; // No suit until first card played
    room.turnDirection = 'clockwise';
    room.punishmentChain = {
      active: false,
      amount: 0,
      cards: [],
    };
    room.rules = {
      cardsPerPlayer: data.cardsPerPlayer,
      customRules: data.customRules,
    };
    room.ruleConfig = ruleConfig;

    await this.saveRoom(room);
    return room;
  }

  static async getRoom(roomId: string): Promise<GameRoom | null> {
    const data = await redisService.get(`${this.ROOM_PREFIX}${roomId}`);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
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

  static async rejoinRoom(socketId: string, roomId: string, username: string, avatar: string): Promise<GameRoom | null> {
    const room = await this.getRoom(roomId);
    
    if (!room) {
      return null;
    }

    // Check if player already exists in room
    const existingPlayerIndex = room.players.findIndex(p => p.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Get old socket ID before updating
      const oldSocketId = room.players[existingPlayerIndex].id;
      
      // Update socket ID for reconnected player
      room.players[existingPlayerIndex].id = socketId;
      
      // If this player was the current turn, update currentTurn to new socket ID
      if (room.currentTurn === oldSocketId) {
        room.currentTurn = socketId;
        console.log(`🔄 Updated currentTurn from ${oldSocketId} to ${socketId}`);
      }
      
      // If this player was the creator, update creatorId
      if (room.creatorId === oldSocketId) {
        room.creatorId = socketId;
        room.players[existingPlayerIndex].isCreator = true;
        console.log(`🔄 Updated creatorId from ${oldSocketId} to ${socketId}`);
      }
      
      await this.saveRoom(room);
      console.log(`🔄 Player ${username} reconnected to room ${roomId} (${oldSocketId} → ${socketId})`);
    } else if (!room.gameStarted) {
      // If game hasn't started, allow new join
      const newPlayer: Player = {
        id: socketId,
        username,
        avatar,
        cards: [],
        isCreator: false,
      };
      room.players.push(newPlayer);
      await this.saveRoom(room);
      console.log(`➕ Player ${username} joined room ${roomId}`);
    } else {
      // Can't join a game in progress as a new player
      throw new Error('Cannot join game in progress');
    }

    return room;
  }

  static async resetGame(room: GameRoom): Promise<GameRoom | null> {
    // Keep players and room info, but reset all game state
    const resetRoom: GameRoom = {
      ...room,
      gameStarted: false,
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
      rules: undefined,
      ruleConfig: undefined,
    };

    // Clear all player cards but keep player info
    resetRoom.players = room.players.map(player => ({
      ...player,
      cards: [],
    }));

    await this.saveRoom(resetRoom);
    console.log(`🔄 Game state reset for room ${room.roomId}`);
    return resetRoom;
  }
}
