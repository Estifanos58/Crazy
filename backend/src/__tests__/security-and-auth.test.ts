import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleService } from '../services/rule.service';
import { GameOrchestrator } from '../services/game.orchestrator';
import { RoomService } from '../services/room.service';
import { GameBroadcaster } from '../services/game-broadcaster.service';
import { playCardSchema, startGameSchema } from '../validation/socket.schemas';
import type { Card, GameRoom, GameState, ServerPlayer } from '../types/game.types';

function createPlayer(
  id: string,
  username: string,
  isCreator = false,
  cards: Card[] = [],
  socketId?: string
): ServerPlayer {
  return {
    id,
    token: `secret_token_${id}_9999`,
    username,
    avatar: '🦊',
    cards,
    isCreator,
    socketId,
    connected: true,
  };
}

describe('Security, Session Takeover Prevention & Authorization Controls', () => {
  it('strictly rejects out-of-turn card play without triggering a blunder', () => {
    const card: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const p1 = createPlayer('p1', 'Alice', true, [card]);
    const p2 = createPlayer('p2', 'Bob', false, [card]);

    const state: GameState = {
      roomId: 'room-auth-1',
      players: [p1, p2],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    const result = RuleService.validateMove(state, 'p2', [card]);
    assert.equal(result.valid, false);
    assert.equal(result.canChallengeCrazy, false);
    assert.equal(result.errors?.[0], 'Not your turn');
  });

  it('rejects duplicate card IDs and forged cards not in authoritative hand', () => {
    const realCard: Card = { id: '7-hearts', rank: '7', suit: 'hearts' };
    const forgedCard: Card = { id: 'A-spades', rank: 'A', suit: 'spades' };
    const p1 = createPlayer('p1', 'Alice', true, [realCard]);

    const state: GameState = {
      roomId: 'room-auth-2',
      players: [p1],
      deck: [],
      pile: [{ id: '4-hearts', rank: '4', suit: 'hearts' }],
      currentTurn: 'p1',
      currentSuit: 'hearts',
      turnDirection: 'clockwise',
      punishmentChain: { active: false, amount: 0, cards: [] },
      ruleConfig: RuleService.getDefaultConfig(),
      gameStarted: true,
      gameEnded: false,
    };

    const dupResult = RuleService.validateMove(state, 'p1', [realCard, realCard]);
    assert.equal(dupResult.valid, false);
    assert.equal(dupResult.canChallengeCrazy, false);
    assert.equal(dupResult.errors?.[0], 'Duplicate card played');

    const forgedResult = RuleService.validateMove(state, 'p1', [forgedCard]);
    assert.equal(forgedResult.valid, false);
    assert.equal(forgedResult.canChallengeCrazy, false);
    assert.ok(forgedResult.errors?.[0]?.includes('not in your hand'));
  });

  it('authenticates player with timing-safe token and refuses socket fallback when invalid credentials are given', () => {
    const p1 = createPlayer('p1', 'Alice', true, [], 'alice-sock');
    const p2 = createPlayer('p2', 'Bob', false, [], 'bob-sock');

    const room: GameRoom = {
      roomId: 'test-auth-room',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      gameStarted: true,
      createdAt: Date.now(),
    };

    assert.equal(
      GameOrchestrator.authenticatePlayer(room, 'sock-unknown', 'p1', 'secret_token_p1_9999')?.id,
      'p1'
    );
    // Wrong token MUST fail even if socketId happens to match!
    assert.equal(
      GameOrchestrator.authenticatePlayer(room, 'alice-sock', 'p1', 'invalid_token'),
      null
    );
    assert.equal(
      GameOrchestrator.authenticatePlayer(room, 'sock-unknown', 'p2', 'secret_token_p1_9999'),
      null
    );
  });

  it('BLOCKS username-based session takeover during lobby, active game, and finished game', async () => {
    const created = await RoomService.createRoom('alice-sock', 'Alice', '🦊');
    const roomId = created.room.roomId;

    // 1. Lobby takeover attempt using Alice's username without credentials -> rejected as duplicate username
    await assert.rejects(
      () => RoomService.rejoinRoom('attacker-sock', roomId, undefined, undefined, 'Alice', '😈'),
      /Username already taken/
    );

    await RoomService.joinRoom('bob-sock', { roomId, username: 'Bob', avatar: '🦁' });
    await RoomService.startGameAuthorized('alice-sock', {
      roomId,
      playerId: created.playerId,
      playerToken: created.playerToken,
      cardsPerPlayer: 5,
    });

    // 2. Active game takeover attempt using Alice's username -> MUST REJECT
    await assert.rejects(
      () => RoomService.rejoinRoom('attacker-sock', roomId, undefined, undefined, 'Alice', '😈'),
      /Valid player credentials are required/
    );

    // 3. Active game takeover attempt with valid playerId + forged token -> MUST REJECT
    await assert.rejects(
      () => RoomService.rejoinRoom('attacker-sock', roomId, created.playerId, 'forged_token'),
      /Invalid player session credentials/
    );

    // 4. Finished game takeover attempt using username -> MUST REJECT
    const room = (await RoomService.getRoom(roomId))!;
    room.gameStarted = false;
    room.gameOver = true;
    room.finishedPlayers = room.players.map((p, idx) => ({ ...p, rank: idx + 1 }));
    room.players = [];
    await RoomService.saveRoom(room);

    await assert.rejects(
      () => RoomService.rejoinRoom('attacker-sock', roomId, undefined, undefined, 'Alice', '😈'),
      /Valid player credentials are required/
    );

    // 5. Legitimate owner with valid credentials CAN reconnect to finished game
    const validRejoin = await RoomService.rejoinRoom(
      'alice-new-sock',
      roomId,
      created.playerId,
      created.playerToken
    );
    assert.ok(validRejoin);
    assert.equal(validRejoin?.playerId, created.playerId);

    await RoomService.deleteRoom(roomId);
  });

  it('enforces valid room lifecycle transitions (join, start, play-again)', async () => {
    const created = await RoomService.createRoom('alice-sock', 'Alice', '🦊');
    const roomId = created.room.roomId;

    // Cannot start game with < 2 players
    await assert.rejects(
      () =>
        RoomService.startGameAuthorized('alice-sock', {
          roomId,
          playerId: created.playerId,
          playerToken: created.playerToken,
          cardsPerPlayer: 5,
        }),
      /At least 2 players/
    );

    // Cannot call play-again in lobby
    const playAgainLobby = await GameOrchestrator.playAgain(
      roomId,
      'alice-sock',
      created.playerId,
      created.playerToken
    );
    assert.equal(playAgainLobby.success, false);

    const bob = (await RoomService.joinRoom('bob-sock', { roomId, username: 'Bob', avatar: '🦁' }))!;

    // Non-creator cannot start game
    await assert.rejects(
      () =>
        RoomService.startGameAuthorized('bob-sock', {
          roomId,
          playerId: bob.playerId,
          playerToken: bob.playerToken,
          cardsPerPlayer: 5,
        }),
      /Only room creator/
    );

    // Start game legitimately
    await RoomService.startGameAuthorized('alice-sock', {
      roomId,
      playerId: created.playerId,
      playerToken: created.playerToken,
      cardsPerPlayer: 5,
    });

    // Cannot join after game started
    await assert.rejects(
      () => RoomService.joinRoom('charlie-sock', { roomId, username: 'Charlie', avatar: '🦉' }),
      /Game already started/
    );

    // Cannot start game twice
    await assert.rejects(
      () =>
        RoomService.startGameAuthorized('alice-sock', {
          roomId,
          playerId: created.playerId,
          playerToken: created.playerToken,
          cardsPerPlayer: 5,
        }),
      /Game already started/
    );

    // Cannot call play-again while game is active (not gameOver)
    const playAgainActive = await GameOrchestrator.playAgain(
      roomId,
      'alice-sock',
      created.playerId,
      created.playerToken
    );
    assert.equal(playAgainActive.success, false);

    await RoomService.deleteRoom(roomId);
  });

  it('never leaks private player cards or session tokens in public room or opponent game states', () => {
    const p1 = createPlayer('p1', 'Alice', true, [{ id: 'A-spades', rank: 'A', suit: 'spades' }]);
    const p2 = createPlayer('p2', 'Bob', false, [{ id: 'K-hearts', rank: 'K', suit: 'hearts' }]);

    const room: GameRoom = {
      roomId: 'room-privacy',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      pile: [],
      gameStarted: true,
      currentTurn: 'p1',
      createdAt: Date.now(),
    };

    const publicRoomJson = JSON.stringify(GameBroadcaster.buildPublicRoom(room));
    assert.ok(!publicRoomJson.includes(p1.token));
    assert.ok(!publicRoomJson.includes(p2.token));
    assert.ok(!publicRoomJson.includes('A-spades'));
    assert.ok(!publicRoomJson.includes('K-hearts'));

    const bobState = GameBroadcaster.buildGameStateResponse(room, p2);
    const bobStateJson = JSON.stringify(bobState);
    assert.ok(!bobStateJson.includes(p1.token));
    assert.ok(!bobStateJson.includes(p2.token));
    assert.ok(!bobStateJson.includes('A-spades')); // Alice's hand NEVER visible to Bob!
    assert.equal(bobState.yourCards.length, 1);
    assert.equal(bobState.yourCards[0].id, 'K-hearts');
  });

  it('validates Socket.IO payloads with runtime Zod schemas', () => {
    assert.equal(startGameSchema.safeParse({ roomId: '123456', cardsPerPlayer: 7 }).success, true);
    assert.equal(startGameSchema.safeParse({ roomId: '123456', cardsPerPlayer: 99 }).success, false);
    assert.equal(
      startGameSchema.safeParse({
        roomId: '123456',
        cardsPerPlayer: 7,
        ruleConfig: { illegalTurnPenalty: -3 },
      }).success,
      false
    );

    assert.equal(
      playCardSchema.safeParse({
        roomId: '123456',
        cards: [{ id: '7-hearts', rank: '7', suit: 'hearts' }],
      }).success,
      true
    );
    assert.equal(
      playCardSchema.safeParse({
        roomId: '123456',
        cards: [{ id: 'X-stars', rank: 'X', suit: 'stars' }],
      }).success,
      false
    );
  });

  it('prevents non-creator from terminating a room and allows authenticated creator to terminate', async () => {
    const p1 = createPlayer('p1', 'Alice', true);
    const p2 = createPlayer('p2', 'Bob', false);

    const room: GameRoom = {
      roomId: 'room-term-test',
      creatorId: 'p1',
      players: [p1, p2],
      deck: [],
      gameStarted: true,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(room);

    const bobAttempt = await GameOrchestrator.leaveGame(
      'room-term-test',
      'bob-socket',
      true,
      'p2',
      p2.token
    );
    assert.equal(bobAttempt.terminated, false);
    assert.equal(bobAttempt.leavingPlayer?.id, 'p2');
    assert.ok(await RoomService.getRoom('room-term-test'));

    const aliceTerminate = await GameOrchestrator.leaveGame(
      'room-term-test',
      'alice-socket',
      true,
      'p1',
      p1.token
    );
    assert.equal(aliceTerminate.terminated, true);
    assert.equal(await RoomService.getRoom('room-term-test'), null);
  });
});
