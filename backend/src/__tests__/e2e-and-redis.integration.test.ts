import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { io as createClientSocket, type Socket as ClientSocket } from 'socket.io-client';
import { createAppServer } from '../server';
import redisService from '../config/redis';
import { TimerService } from '../services/timer.service';
import type {
  CreateRoomResponse,
  GameStartedPayload,
  GameStateResponse,
  GetGameStateResponse,
  JoinRoomResponse,
  RejoinRoomResponse,
  StandardResponse,
} from '../types/game.types';

function emitAck<TRes>(socket: ClientSocket, event: string, payload: unknown): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), 5000);
    socket.emit(event, payload, (response: TRes) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 5000);
    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

describe('End-to-End Multiplayer Socket.IO & Health Endpoints', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;

  before(async () => {
    if (process.env.TEST_REDIS_URL) {
      await redisService.connect(process.env.TEST_REDIS_URL);
    }

    const { httpServer, io } = createAppServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    closeServer = async () => {
      TimerService.clearAllTimers();
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      if (process.env.TEST_REDIS_URL) {
        await redisService.disconnect();
      }
    };
  });

  after(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it('serves liveness and readiness health endpoints', async () => {
    const liveRes = await fetch(`${baseUrl}/health/live`);
    assert.equal(liveRes.status, 200);
    const liveBody = (await liveRes.json()) as { status: string };
    assert.equal(liveBody.status, 'ok');

    const readyRes = await fetch(`${baseUrl}/health/ready`);
    assert.equal(readyRes.status, 200);
    const readyBody = (await readyRes.json()) as { status: string; store: string };
    assert.equal(readyBody.status, 'ready');
    if (process.env.TEST_REDIS_URL) {
      assert.equal(readyBody.store, 'redis');
    }
  });

  it('runs a full secure multiplayer lifecycle (create, join, start, privacy, blunder, no-revert rejection, reconnect)', async () => {
    const alice = createClientSocket(baseUrl, { transports: ['websocket'] });
    const bob = createClientSocket(baseUrl, { transports: ['websocket'] });
    const attacker = createClientSocket(baseUrl, { transports: ['websocket'] });

    try {
      await Promise.all([
        waitForEvent(alice, 'connect'),
        waitForEvent(bob, 'connect'),
        waitForEvent(attacker, 'connect'),
      ]);

      // 1. Malformed create-room payload rejected by Zod
      const badCreate = await emitAck<CreateRoomResponse>(alice, 'create-room', {
        username: '',
        avatar: '',
      });
      assert.equal(badCreate.success, false);

      // 2. Alice creates a room
      const createRes = await emitAck<CreateRoomResponse>(alice, 'create-room', {
        username: 'Alice',
        avatar: '🦊',
      });
      assert.equal(createRes.success, true);
      assert.ok(createRes.roomId && createRes.playerId && createRes.playerToken);
      const roomId = createRes.roomId;

      // 3. Bob joins the room
      const joinRes = await emitAck<JoinRoomResponse>(bob, 'join-room', {
        roomId,
        username: 'Bob',
        avatar: '🦁',
      });
      assert.equal(joinRes.success, true);
      assert.ok(joinRes.playerId && joinRes.playerToken);
      // Public room payload must NOT expose Alice's token
      assert.ok(!JSON.stringify(joinRes.room).includes(createRes.playerToken));

      // 4. Start game (listen for each player's private game-started event)
      const aliceStartedPromise = waitForEvent<GameStartedPayload>(alice, 'game-started');
      const bobStartedPromise = waitForEvent<GameStartedPayload>(bob, 'game-started');

      const startRes = await emitAck<StandardResponse>(alice, 'start-game', {
        roomId,
        playerId: createRes.playerId,
        playerToken: createRes.playerToken,
        cardsPerPlayer: 5,
      });
      assert.equal(startRes.success, true);

      const [aliceStart, bobStart] = await Promise.all([aliceStartedPromise, bobStartedPromise]);
      assert.equal(aliceStart.yourCards.length, 6); // Starting player gets +1
      assert.equal(bobStart.yourCards.length, 5);
      // Verify hands are completely disjoint (no card duplication or leak)
      const aliceCardIds = new Set(aliceStart.yourCards.map((c) => c.id));
      for (const card of bobStart.yourCards) {
        assert.equal(aliceCardIds.has(card.id), false);
      }

      // 5. Attacker attempts username-based session takeover -> REJECTED!
      const takeoverRes = await emitAck<RejoinRoomResponse>(attacker, 'rejoin-room', {
        roomId,
        username: 'Alice',
        avatar: '😈',
      });
      assert.equal(takeoverRes.success, false);

      // 6. Alice plays a valid opening card
      const firstCard = aliceStart.yourCards[0];
      const playRes = await emitAck<StandardResponse>(alice, 'play-card', {
        roomId,
        playerId: createRes.playerId,
        playerToken: createRes.playerToken,
        cards: [firstCard],
        chosenSuit: firstCard.rank === 'J' || firstCard.rank === '8' ? 'hearts' : undefined,
      });
      assert.equal(playRes.success, true);

      // 7. Client-initiated `no-revert` MUST always be rejected
      const noRevertRes = await emitAck<StandardResponse>(attacker, 'no-revert', { roomId });
      assert.equal(noRevertRes.success, false);

      // 8. Bob disconnects and reconnects on a fresh socket with valid credentials
      bob.disconnect();
      const bobReconnected = createClientSocket(baseUrl, { transports: ['websocket'] });
      try {
        await waitForEvent(bobReconnected, 'connect');

        const rejoinRes = await emitAck<RejoinRoomResponse>(bobReconnected, 'rejoin-room', {
          roomId,
          playerId: joinRes.playerId,
          playerToken: joinRes.playerToken,
        });
        assert.equal(rejoinRes.success, true);

        const stateRes = await emitAck<GetGameStateResponse>(bobReconnected, 'get-game-state', {
          roomId,
          playerId: joinRes.playerId,
          playerToken: joinRes.playerToken,
        });
        assert.equal(stateRes.success, true);
        const gameState: GameStateResponse = stateRes.gameState!;
        assert.equal(gameState.yourCards.length, 5);
        assert.equal(gameState.topCard?.id, firstCard.id);
        // Verify Alice's private cards are NOT leaked in Bob's state
        const bobStateJson = JSON.stringify(gameState);
        for (const remainingAliceCard of aliceStart.yourCards.slice(1)) {
          assert.ok(!bobStateJson.includes(remainingAliceCard.id));
        }

        // 9. Verify blunder -> revert and blunder -> call-crazy over live Socket.IO
        // Find a card in Bob's hand that does not match topCard suit/rank and isn't J/8/2/A♠
        const illegalCard = gameState.yourCards.find(
          (c) =>
            c.suit !== gameState.currentSuit &&
            c.rank !== gameState.topCard?.rank &&
            c.rank !== 'J' &&
            c.rank !== '8' &&
            c.rank !== '2' &&
            !(c.rank === 'A' && c.suit === 'spades')
        );

        if (illegalCard && gameState.currentTurn === joinRes.playerId) {
          // 9a. Bob blunders and reverts
          const blunderPlay = await emitAck<StandardResponse>(bobReconnected, 'play-card', {
            roomId,
            playerId: joinRes.playerId,
            playerToken: joinRes.playerToken,
            cards: [illegalCard],
          });
          assert.equal(blunderPlay.success, true);
          assert.equal(blunderPlay.isBlunder, true);

          // Attacker still cannot force no-revert during an active blunder!
          const attackerNoRevert = await emitAck<StandardResponse>(attacker, 'no-revert', {
            roomId,
          });
          assert.equal(attackerNoRevert.success, false);

          // Bob reverts before challenge
          const revertRes = await emitAck<StandardResponse>(bobReconnected, 'revert-blunder', {
            roomId,
            playerId: joinRes.playerId,
            playerToken: joinRes.playerToken,
          });
          assert.equal(revertRes.success, true);

          // 9b. Bob blunders again and Alice calls Crazy!
          const blunderPlay2 = await emitAck<StandardResponse>(bobReconnected, 'play-card', {
            roomId,
            playerId: joinRes.playerId,
            playerToken: joinRes.playerToken,
            cards: [illegalCard],
          });
          assert.equal(blunderPlay2.success, true);
          assert.equal(blunderPlay2.isBlunder, true);

          const crazyRes = await emitAck<StandardResponse>(alice, 'call-crazy', {
            roomId,
            playerId: createRes.playerId,
            playerToken: createRes.playerToken,
          });
          assert.equal(crazyRes.success, true);

          // Bob's hand should now have 5 + 2 = 7 cards with zero duplicates
          const afterCrazyState = await emitAck<GetGameStateResponse>(
            bobReconnected,
            'get-game-state',
            {
              roomId,
              playerId: joinRes.playerId,
              playerToken: joinRes.playerToken,
            }
          );
          assert.equal(afterCrazyState.gameState?.yourCards.length, 7);
          assert.equal(
            new Set(afterCrazyState.gameState?.yourCards.map((c) => c.id)).size,
            7
          );
        }
      } finally {
        bobReconnected.disconnect();
      }
    } finally {
      alice.disconnect();
      bob.disconnect();
      attacker.disconnect();
    }
  });
});
