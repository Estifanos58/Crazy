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
}
