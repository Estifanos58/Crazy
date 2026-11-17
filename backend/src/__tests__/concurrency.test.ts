import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoomLockService } from '../services/lock.service';
import { RoomService } from '../services/room.service';
import type { GameRoom } from '../types/game.types';

describe('Concurrency Control & State Protection', () => {
  it('serializes concurrent operations on the same room', async () => {
    const roomId = 'concurrency-room-test';
    const initialRoom: GameRoom = {
      roomId,
      creatorId: 'p1',
      players: [
        {
          id: 'p1',
          token: 'token_p1',
          username: 'Alice',
          avatar: '🎮',
          cards: [],
          isCreator: true,
          connected: true,
        },
      ],
      gameStarted: true,
      deck: [],
      drawCount: 0,
      createdAt: Date.now(),
    };

    await RoomService.saveRoom(initialRoom);

    // Run 10 concurrent operations incrementing drawCount
    const operations = Array.from({ length: 10 }).map((_, index) => {
      return RoomLockService.runWithLock(roomId, async () => {
        const room = await RoomService.getRoom(roomId);
        if (!room) throw new Error('Room not found');
        
        // Artificial small delay to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 15));
        
        room.drawCount = (room.drawCount || 0) + 1;
        await RoomService.saveRoom(room);
        return room.drawCount;
      });
    });

    const results = await Promise.all(operations);

    // Final room state must have drawCount === 10
    const finalRoom = await RoomService.getRoom(roomId);
    assert.equal(finalRoom?.drawCount, 10);
    assert.equal(results.length, 10);

    await RoomService.deleteRoom(roomId);
  });
});
