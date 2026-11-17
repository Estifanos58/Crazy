import type { Server } from 'socket.io';
import { RoomService } from './room.service';
import { RuleService } from './rule.service';
import { CardService } from './card.service';
import { RoomLockService } from './lock.service';
import { TimerService } from './timer.service';
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
   * Authenticate player in room by token/id or socket fallback
   */
  static authenticatePlayer(
    room: GameRoom,
    socketId: string,
    playerId?: string,
    playerToken?: string
  ): ServerPlayer | null {
    // 1. Authenticate with persistent credentials
    if (playerId && playerToken) {
      const match = room.players.find(p => p.id === playerId && p.token === playerToken);
      if (match) return match;
      if (room.finishedPlayers) {
        const finishedMatch = room.finishedPlayers.find(p => p.id === playerId && p.token === playerToken);
        if (finishedMatch) return finishedMatch;
      }
    }

    // 2. Fallback to socket ID if connected
    const socketMatch = room.players.find(p => p.socketId === socketId);
    if (socketMatch) return socketMatch;
    if (room.finishedPlayers) {
      const finishedSocketMatch = room.finishedPlayers.find(p => p.socketId === socketId);
      if (finishedSocketMatch) return finishedSocketMatch;
    }

    return null;
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

      const player = this.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) {
        return { success: false, error: 'Unauthorized or player not found', events: [] };
      }

      // If player already finished, they cannot play
      if (room.finishedPlayers?.some(fp => fp.id === player.id)) {
        return { success: false, error: 'You have already finished this game', events: [] };
      }

      // Check turn ownership
      if (room.currentTurn !== player.id) {
        return { success: false, error: 'Not your turn', events: [] };
      }

      // If there is an active blunder in the room, it must be resolved first
      if (room.blunderState && room.blunderState.active) {
        return { success: false, error: 'Cannot play while an active blunder is pending resolution', events: [] };
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

      // Validate move (authoritative backend)
      const validation = RuleService.validateMove(gameState, player.id, cards);
      const isBlunder = !validation.valid && validation.canChallengeCrazy;

      if (!validation.valid && !isBlunder) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid move',
          events: [],
        };
      }

      // Handle Blunder
      if (isBlunder) {
        const ruleConfig = RuleService.mergeConfig(room.ruleConfig);

        // Remove cards from player's hand during blunder so no duplication can occur!
        for (const card of cards) {
          const cardIdx = player.cards.findIndex(c => c.id === card.id);
          if (cardIdx !== -1) {
            player.cards.splice(cardIdx, 1);
          }
        }

        const revertTimeoutMs = 5000;
        const challengeTimeoutMs = 8000;

        room.blunderState = {
          active: true,
          playerId: player.id,
          cards: cards,
          penalty: ruleConfig.illegalTurnPenalty,
          timestamp: Date.now(),
          revertTimeoutMs,
          challengeTimeoutMs,
        };

        await RoomService.saveRoom(room);

        // Schedule server-side timeout
        if (io) {
          TimerService.setTimer(`blunder:${roomId}`, challengeTimeoutMs, async () => {
            await GameOrchestrator.handleBlunderTimeout(roomId, io);
          });
        }

        const events: GameEvent[] = [
          {
            type: 'invalid-move',
            payload: {
              playerId: player.id,
              reason: validation.errors?.[0] || 'Invalid move',
              canBeChallenged: true,
              cards: cards,
              timeoutMs: challengeTimeoutMs,
            },
          },
        ];

        return {
          success: true,
          isBlunder: true,
          events,
          room,
        };
      }

      // Valid Move: Apply card effects
      TimerService.clearRoomTimers(roomId);
      room.blunderState = undefined;

      const { updatedState, events } = RuleService.applyCardEffects(
        gameState,
        player.id,
        cards,
        chosenSuit,
        cards.length > 1
      );

      // Check if player finished (ran out of cards)
      const finishedPlayer = updatedState.players.find(p => p.id === player.id && p.cards.length === 0);
      if (finishedPlayer) {
        if (!room.finishedPlayers) room.finishedPlayers = [];
        const rank = room.finishedPlayers.length + 1;
        finishedPlayer.rank = rank;
        finishedPlayer.finishedAt = Date.now();

        room.players = updatedState.players.filter(p => p.id !== finishedPlayer.id);
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

          // Assign final rank to remaining player if any
          if (room.players.length === 1) {
            const lastPlayer = room.players[0];
            lastPlayer.rank = rank + 1;
            lastPlayer.finishedAt = Date.now();
            room.finishedPlayers.push(lastPlayer);
            room.players = [];
          }

          const rankings: RankedPlayer[] = RoomService.sanitizeRankedPlayers(room.finishedPlayers);
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
      room.currentTurn = updatedState.currentTurn;
      room.currentSuit = updatedState.currentSuit;
      room.turnDirection = updatedState.turnDirection;
      room.punishmentChain = updatedState.punishmentChain;
      room.lastSuitChangedBy = updatedState.lastSuitChangedBy;
      room.drawCount = 0; // Reset draw count when a valid card is played

      await RoomService.saveRoom(room);
      return { success: true, events, room };
    });
  }

  /**
   * Revert blunder move
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

      const player = this.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { success: false, error: 'Unauthorized', events: [] };

      if (!room.blunderState || !room.blunderState.active || room.blunderState.playerId !== player.id) {
        return { success: false, error: 'No active blunder to revert', events: [] };
      }

      // Check timeout (default 5s)
      const timeoutMs = room.blunderState.revertTimeoutMs || 5000;
      if (Date.now() - room.blunderState.timestamp > timeoutMs) {
        return { success: false, error: 'Revert window has expired', events: [] };
      }

      TimerService.clearRoomTimers(roomId);

      // Return cards safely to player hand (they were removed on blunder play)
      player.cards.push(...room.blunderState.cards);
      room.blunderState = undefined;

      await RoomService.saveRoom(room);

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
   * Challenge blunder by calling Crazy
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

      const caller = this.authenticatePlayer(room, socketId, callerId, callerToken);
      if (!caller) return { success: false, error: 'Unauthorized', events: [] };

      if (!room.blunderState || !room.blunderState.active) {
        return { success: false, error: 'No active blunder to challenge', events: [] };
      }

      // Caller cannot challenge their own blunder!
      if (caller.id === room.blunderState.playerId) {
        return { success: false, error: 'Cannot call crazy on your own blunder', events: [] };
      }

      // Check challenge window (default 8s)
      const timeoutMs = room.blunderState.challengeTimeoutMs || 8000;
      if (Date.now() - room.blunderState.timestamp > timeoutMs) {
        return { success: false, error: 'Challenge window has expired', events: [] };
      }

      TimerService.clearRoomTimers(roomId);

      const blunderPlayer = room.players.find(p => p.id === room.blunderState!.playerId);
      if (!blunderPlayer) {
        room.blunderState = undefined;
        await RoomService.saveRoom(room);
        return { success: false, error: 'Blunder player not found', events: [] };
      }

      // Return the played blunder cards to the player
      blunderPlayer.cards.push(...room.blunderState.cards);

      // Apply penalty cards
      const penalty = room.blunderState.penalty || 2;
      const penaltyCards = CardService.drawCards(room, penalty);
      blunderPlayer.cards.push(...penaltyCards);

      // Turn remains with blunder player per Crazy rules
      room.currentTurn = blunderPlayer.id;
      room.blunderState = undefined;

      await RoomService.saveRoom(room);

      const events: GameEvent[] = [
        {
          type: 'crazy-called',
          payload: {
            success: true,
            callerId: caller.id,
            targetId: blunderPlayer.id,
            penalty,
          },
        },
        {
          type: 'cards_drawn',
          playerId: blunderPlayer.id,
          amount: penalty,
        },
      ];

      return { success: true, events, room };
    });
  }

  /**
   * Handle server-side blunder timeout (no revert and no challenge)
   */
  static async handleBlunderTimeout(roomId: string, io: Server): Promise<void> {
    await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room || !room.blunderState || !room.blunderState.active) return;

      const blunderPlayer = room.players.find(p => p.id === room.blunderState!.playerId);
      if (!blunderPlayer) {
        room.blunderState = undefined;
        await RoomService.saveRoom(room);
        return;
      }

      // Return cards to hand
      blunderPlayer.cards.push(...room.blunderState.cards);

      // Draw penalty cards
      const penalty = room.blunderState.penalty || 2;
      const penaltyCards = CardService.drawCards(room, penalty);
      blunderPlayer.cards.push(...penaltyCards);

      // Advance turn to next player
      const currentIndex = room.players.findIndex(p => p.id === blunderPlayer.id);
      const direction = room.turnDirection === 'clockwise' ? 1 : -1;
      const nextIndex = (currentIndex + direction + room.players.length) % room.players.length;
      room.currentTurn = room.players[nextIndex].id;
      room.drawCount = 0;
      room.blunderState = undefined;

      await RoomService.saveRoom(room);

      // Broadcast events
      const events: GameEvent[] = [
        {
          type: 'blunder-timeout',
          payload: {
            playerId: blunderPlayer.id,
            penalty,
            message: 'Blunder not reverted - penalty applied',
          },
        },
        {
          type: 'cards_drawn',
          playerId: blunderPlayer.id,
          amount: penalty,
        },
      ];

      events.forEach(e => io.to(room.roomId).emit('game-event', e));
      this.broadcastGameUpdate(room, io);
    });
  }

  /**
   * Take punishment or draw single card
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

      const player = this.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { success: false, error: 'Unauthorized', events: [] };

      // Strictly enforce turn ownership
      if (room.currentTurn !== player.id) {
        return { success: false, error: 'Not your turn to draw or take punishment', events: [] };
      }

      // Cannot draw while an active blunder is pending
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

      // Active punishment chain
      if (gameState.punishmentChain.active && gameState.punishmentChain.amount > 0) {
        const result = RuleService.takePunishmentCardsNoAdvance(gameState, player.id);
        updatedState = result.updatedState;
        events = result.events;
        room.drawCount = 0;
      } else {
        // No punishment: draw 1 card or pass turn if already drew
        if (room.drawCount >= 1) {
          // Already drew 1 card: pass turn to next player
          updatedState = { ...gameState };
          const currentIndex = gameState.players.findIndex(p => p.id === player.id);
          const direction = gameState.turnDirection === 'clockwise' ? 1 : -1;
          const nextIndex = (currentIndex + direction + gameState.players.length) % gameState.players.length;
          updatedState.currentTurn = gameState.players[nextIndex].id;
          room.drawCount = 0;
        } else {
          // First draw: draw 1 card, turn stays
          room.drawCount = 1;
          const result = RuleService.drawSingleCardNoAdvance(gameState, player.id);
          updatedState = result.updatedState;
          events = result.events;
        }
      }

      room.players = updatedState.players;
      room.deck = updatedState.deck;
      room.currentTurn = updatedState.currentTurn;
      room.punishmentChain = updatedState.punishmentChain;

      await RoomService.saveRoom(room);
      return { success: true, events, room };
    });
  }

  /**
   * Leave game or terminate room
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
    error?: string;
  }> {
    return await RoomLockService.runWithLock(roomId, async () => {
      const room = await RoomService.getRoom(roomId);
      if (!room) return { terminated: false, error: 'Room not found' };

      const player = this.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { terminated: false, error: 'Player not found in room' };

      // Strictly check creator authority for termination!
      const isActualCreator = room.creatorId === player.id;
      if (isCreatorRequested && isActualCreator) {
        TimerService.clearRoomTimers(roomId);
        await RoomService.deleteRoom(roomId);
        return { terminated: true, leavingPlayer: player };
      }

      // Regular player leaving
      room.players = room.players.filter(p => p.id !== player.id);
      if (room.finishedPlayers) {
        room.finishedPlayers = room.finishedPlayers.filter(p => p.id !== player.id);
      }

      // If leaving player was creator, transfer host to next player
      if (isActualCreator && room.players.length > 0) {
        room.creatorId = room.players[0].id;
        room.players[0].isCreator = true;
      }

      // Advance turn if leaving player had current turn
      if (room.gameStarted && room.currentTurn === player.id && room.players.length > 0) {
        room.currentTurn = room.players[0].id;
      }

      // If only 1 player remains in an active game, end game
      if (room.gameStarted && room.players.length <= 1) {
        room.gameOver = true;
        room.gameStarted = false;
      }

      await RoomService.saveRoom(room);
      return { terminated: false, leavingPlayer: player, room };
    });
  }

  /**
   * Play Again / Restart Game
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

      const player = this.authenticatePlayer(room, socketId, playerId, playerToken);
      if (!player) return { success: false, error: 'Unauthorized' };

      // Only host/creator can restart the game
      if (room.creatorId !== player.id) {
        return { success: false, error: 'Only room host can start a new game' };
      }

      TimerService.clearRoomTimers(roomId);

      // Reset game and restore all finished players back into room.players
      const resetRoom = await RoomService.resetGame(room);

      const cardsPerPlayer = resetRoom.rules?.cardsPerPlayer || 7;
      const customRules = resetRoom.rules?.customRules;

      const startedRoom = await RoomService.startGame({
        roomId,
        cardsPerPlayer,
        customRules,
        ruleConfig: resetRoom.ruleConfig,
      });

      if (!startedRoom) {
        return { success: false, error: 'Failed to start new game' };
      }

      return { success: true, room: startedRoom };
    });
  }

  /**
   * Broadcast game update safely to all players
   */
  static broadcastGameUpdate(room: GameRoom, io: Server): void {
    const allPlayers = [...room.players, ...(room.finishedPlayers || [])];

    const sanitizedActive = RoomService.sanitizePlayers(room.players);
    const sanitizedFinished = RoomService.sanitizeRankedPlayers(room.finishedPlayers || []);
    const topCard = room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined;

    allPlayers.forEach(player => {
      const target = player.socketId || `player:${player.id}`;
      io.to(target).emit('game-update', {
        players: sanitizedActive,
        finishedPlayers: sanitizedFinished,
        currentTurn: room.currentTurn,
        topCard,
        currentSuit: room.currentSuit,
        yourCards: player.cards,
        punishmentChain: room.punishmentChain,
        drawCount: room.drawCount || 0,
      });
    });
  }
}
