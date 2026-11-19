import type { Server } from 'socket.io';
import { RoomService } from './room.service';
import { RuleService } from './rule.service';
import { RoomLockService } from './lock.service';
import { SessionAuthService } from './session-auth.service';
import { BlunderService } from './blunder.service';
import { GameBroadcaster } from './game-broadcaster.service';
import { metrics } from '../utils/metrics';
import type {
  Card,
  GameEvent,
  GameRoom,
  GameState,
  RankedPlayer,
  ServerPlayer,
  Suit,
} from '../types/game.types';

export class GameOrchestrator {
  /**
   * Delegate authentication to SessionAuthService
   */
  static authenticatePlayer(
    room: GameRoom,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ): ServerPlayer | null {
    return SessionAuthService.authenticatePlayer(room, socketId, playerId, playerToken);
  }

  /**
   * Play card(s)
   */
  static async playCard(
    roomId: string,
    socketId: string,
    cards: Card[],
    chosenSuit?: Suit,
    playerId?: string,
    playerToken?: string,
    io?: Server
  ): Promise<{
    success: boolean;
    isBlunder?: boolean;
    error?: string;
    events: GameEvent[];
    room?: GameRoom;
  }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found', events: [] };
      }

      if (!room.gameStarted || room.gameOver) {
        return { success: false, error: 'Game is not in progress', events: [] };
      }

      const player = SessionAuthService.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) {
        return { success: false, error: 'Unauthorized or player not found', events: [] };
      }

      if (room.finishedPlayers?.some((fp) => fp.id === player.id)) {
        return { success: false, error: 'You have already finished this game', events: [] };
      }

      if (room.currentTurn !== player.id) {
        return { success: false, error: 'Not your turn', events: [] };
      }

      if (room.blunderState && room.blunderState.active) {
        return {
          success: false,
          error: 'Cannot play while an active blunder is pending resolution',
          events: [],
        };
      }

      const gameState: GameState = {
        roomId: room.roomId,
        players: room.players,
        deck: room.deck,
        pile: room.pile || [],
        currentTurn: room.currentTurn!,
        currentSuit: room.currentSuit || (cards[0] ? cards[0].suit : 'hearts'),
        turnDirection: room.turnDirection || 'clockwise',
        punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
        ruleConfig: room.ruleConfig,
        gameStarted: room.gameStarted,
        gameEnded: false,
        lastSuitChangedBy: room.lastSuitChangedBy,
      };

      const validation = RuleService.validateMove(gameState, player.id, cards);
      const isBlunder = !validation.valid && Boolean(validation.canChallengeCrazy);

      if (!validation.valid && !isBlunder) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid move',
          events: [],
        };
      }

      // Handle blunder via BlunderService
      if (isBlunder) {
        const blunderResult = await BlunderService.registerBlunderUnlocked(
          room,
          player,
          cards,
          validation.errors?.[0] || 'Invalid move',
          io
        );
        return {
          success: true,
          isBlunder: true,
          events: blunderResult.events,
          room: blunderResult.room,
        };
      }

      // Valid Move: Apply card effects
      await BlunderService.clearDeadline(roomId);
      room.blunderState = undefined;

      const effectiveConfig = RuleService.mergeConfig(room.ruleConfig);
      const { updatedState, events } = RuleService.applyCardEffects(
        gameState,
        player.id,
        cards,
        chosenSuit,
        cards.length > 1
      );

      // Check if player finished (respecting ruleConfig.winOnEmpty consistently with RuleService!)
      const finishedPlayer = effectiveConfig.winOnEmpty
        ? updatedState.players.find((p) => p.id === player.id && p.cards.length === 0)
        : undefined;
      if (finishedPlayer) {
        if (!room.finishedPlayers) room.finishedPlayers = [];
        const rank = room.finishedPlayers.length + 1;
        finishedPlayer.rank = rank;
        finishedPlayer.finishedAt = Date.now();

        room.players = updatedState.players.filter((p) => p.id !== finishedPlayer.id);
        room.finishedPlayers.push(finishedPlayer);

        events.push({
          type: 'player-finished',
          payload: {
            playerId: finishedPlayer.id,
            playerName: finishedPlayer.username,
            rank,
          },
        });

        // If active players <= 1, game is over!
        if (room.players.length <= 1) {
          room.gameOver = true;
          room.gameStarted = false;

          if (room.players.length === 1) {
            const lastPlayer = room.players[0];
            lastPlayer.rank = rank + 1;
            lastPlayer.finishedAt = Date.now();
            room.finishedPlayers.push(lastPlayer);
            room.players = [];
          }

          const rankings: RankedPlayer[] = GameBroadcaster.sanitizeRankedPlayers(
            room.finishedPlayers
          );
          events.push({
            type: 'game-over',
            payload: { rankings },
          });
        }
      } else {
        room.players = updatedState.players;
      }

      room.deck = updatedState.deck;
      room.pile = updatedState.pile;
      room.currentTurn = room.gameOver ? undefined : updatedState.currentTurn;
      room.currentSuit = updatedState.currentSuit;
      room.turnDirection = updatedState.turnDirection;
      room.punishmentChain = updatedState.punishmentChain;
      room.lastSuitChangedBy = updatedState.lastSuitChangedBy;
      room.drawCount = 0;

      await RoomService.saveRoom(room);
      return { success: true, events, room };
    });
  }

  static revertBlunder(
    roomId: string,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ) {
    return BlunderService.revertBlunder(roomId, socketId, playerId, playerToken);
  }

  static callCrazy(
    roomId: string,
    socketId: string,
    callerId?: string,
    callerToken?: string
  ) {
    return BlunderService.callCrazy(roomId, socketId, callerId, callerToken);
  }

  static handleBlunderTimeout(roomId: string, io?: Server) {
    return BlunderService.handleBlunderTimeout(roomId, io);
  }

  /**
   * Take punishment or draw single card / pass turn
   */
  static async takePunishment(
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

      if (room.currentTurn !== player.id) {
        return { success: false, error: 'Not your turn to draw or take punishment', events: [] };
      }

      if (room.blunderState && room.blunderState.active) {
        return { success: false, error: 'Cannot take action while blunder is pending', events: [] };
      }

      if (room.drawCount === undefined) room.drawCount = 0;

      const gameState: GameState = {
        roomId: room.roomId,
        players: room.players,
        deck: room.deck,
        pile: room.pile || [],
        currentTurn: room.currentTurn!,
        currentSuit: room.currentSuit || 'hearts',
        turnDirection: room.turnDirection || 'clockwise',
        punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
        ruleConfig: room.ruleConfig,
        gameStarted: room.gameStarted,
        gameEnded: false,
      };

      let events: GameEvent[] = [];
      let updatedState: GameState;

      if (gameState.punishmentChain.active && gameState.punishmentChain.amount > 0) {
        const result = RuleService.takePunishmentCardsNoAdvance(gameState, player.id);
        updatedState = result.updatedState;
        events = result.events;
        room.drawCount = 0;
      } else if (room.drawCount >= 1) {
        // Already drew 1 card: pass turn to next active player
        updatedState = { ...gameState };
        const currentIndex = gameState.players.findIndex((p) => p.id === player.id);
        const direction = gameState.turnDirection === 'clockwise' ? 1 : -1;
        const nextIndex =
          (currentIndex + direction + gameState.players.length) % gameState.players.length;
        updatedState.currentTurn = gameState.players[nextIndex].id;
        room.drawCount = 0;
      } else {
        // First draw: draw 1 card, turn stays
        room.drawCount = 1;
        const result = RuleService.drawSingleCardNoAdvance(gameState, player.id);
        updatedState = result.updatedState;
        events = result.events;
      }

      room.players = updatedState.players;
      room.deck = updatedState.deck;
      room.pile = updatedState.pile;
      room.currentTurn = updatedState.currentTurn;
      room.punishmentChain = updatedState.punishmentChain;

      await RoomService.saveRoom(room);
      return { success: true, events, room };
    });
  }

  /**
   * Leave game or terminate room (host only)
   */
  static async leaveGame(
    roomId: string,
    socketId: string,
    isCreatorRequested: boolean,
    playerId?: string,
    playerToken?: string
  ): Promise<{
    terminated: boolean;
    leavingPlayer?: ServerPlayer;
    room?: GameRoom;
    events: GameEvent[];
    error?: string;
  }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) return { terminated: false, events: [], error: 'Room not found' };

      const player = SessionAuthService.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { terminated: false, events: [], error: 'Player not found in room' };

      const isActualCreator = room.creatorId === player.id;
      if (isCreatorRequested && isActualCreator) {
        await BlunderService.clearDeadline(roomId);
        await RoomService.deleteRoom(roomId);
        metrics.inc('rooms_terminated_total');
        return { terminated: true, leavingPlayer: player, events: [] };
      }

      const events: GameEvent[] = [];

      // Compute next turn BEFORE removing the leaving player so turn order stays accurate
      let nextTurnAfterLeave = room.currentTurn;
      const leavingIndex = room.players.findIndex((p) => p.id === player.id);
      if (room.gameStarted && room.currentTurn === player.id && room.players.length > 1 && leavingIndex !== -1) {
        const direction = room.turnDirection === 'clockwise' ? 1 : -1;
        const nextIdx = (leavingIndex + direction + room.players.length) % room.players.length;
        nextTurnAfterLeave = room.players[nextIdx].id;
      }

      // Clear active blunder if the leaving player caused it
      if (room.blunderState?.active && room.blunderState.playerId === player.id) {
        await BlunderService.clearDeadline(roomId);
        room.blunderState = undefined;
      }

      // Remove player from active and finished lists
      room.players = room.players.filter((p) => p.id !== player.id);
      if (room.finishedPlayers) {
        room.finishedPlayers = room.finishedPlayers.filter((p) => p.id !== player.id);
      }

      // If room is now completely empty, clean up Redis + timers
      const totalRemaining = room.players.length + (room.finishedPlayers?.length || 0);
      if (totalRemaining === 0) {
        await BlunderService.clearDeadline(roomId);
        await RoomService.deleteRoom(roomId);
        metrics.inc('rooms_terminated_total');
        return { terminated: true, leavingPlayer: player, events: [] };
      }

      // Transfer host if leaving player was creator
      if (isActualCreator) {
        const nextHost = room.players[0] || room.finishedPlayers?.[0];
        if (nextHost) {
          room.creatorId = nextHost.id;
          nextHost.isCreator = true;
        }
      }

      if (room.gameStarted && room.currentTurn === player.id) {
        room.currentTurn = nextTurnAfterLeave;
        room.drawCount = 0;
      }

      // If <= 1 active players remain during an active game, conclude the match properly
      if (room.gameStarted && room.players.length <= 1) {
        await BlunderService.clearDeadline(roomId);
        room.gameOver = true;
        room.gameStarted = false;
        room.currentTurn = undefined;

        if (!room.finishedPlayers) room.finishedPlayers = [];
        if (room.players.length === 1) {
          const winner = room.players[0];
          winner.rank = room.finishedPlayers.length + 1;
          winner.finishedAt = Date.now();
          room.finishedPlayers.push(winner);
          room.players = [];
        }

        const rankings = GameBroadcaster.sanitizeRankedPlayers(room.finishedPlayers);
        events.push({
          type: 'game-over',
          payload: { rankings },
        });
      }

      await RoomService.saveRoom(room);
      return { terminated: false, leavingPlayer: player, room, events };
    });
  }

  /**
   * Play Again / Restart Game (strictly enforces gameOver lifecycle & host auth)
   */
  static async playAgain(
    roomId: string,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ): Promise<{ success: boolean; error?: string; room?: GameRoom }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) return { success: false, error: 'Room not found' };

      const player = SessionAuthService.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { success: false, error: 'Unauthorized' };

      if (room.creatorId !== player.id) {
        return { success: false, error: 'Only room host can start a new game' };
      }

      // Enforce lifecycle: Play Again is only valid after a game has ended
      if (!room.gameOver) {
        return { success: false, error: 'Cannot restart while a game is not finished' };
      }

      const totalPlayers = room.players.length + (room.finishedPlayers?.length || 0);
      if (totalPlayers < 2) {
        return { success: false, error: 'At least 2 players are required to play again' };
      }

      await BlunderService.clearDeadline(roomId);

      const resetRoom = await RoomService.resetGameUnlocked(room);

      const cardsPerPlayer = resetRoom.rules?.cardsPerPlayer || 7;
      const customRules = resetRoom.rules?.customRules;
      const rulePreset = resetRoom.rules?.rulePreset;

      const startedRoom = await RoomService.startGameUnlocked(resetRoom, {
        roomId,
        cardsPerPlayer,
        customRules,
        rulePreset,
        ruleConfig: resetRoom.ruleConfig,
      });

      return { success: true, room: startedRoom };
    });
  }

  static broadcastGameUpdate(room: GameRoom, io: Server): void {
    GameBroadcaster.broadcastGameUpdate(room, io);
  }
}
