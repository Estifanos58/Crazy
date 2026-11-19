import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { emitWithAck } from '@/lib/store/socket-actions';

describe('Socket.IO emitWithAck helper', () => {
  it('returns error immediately when socket is disconnected', async () => {
    const res = await emitWithAck(null, 'play-card', { roomId: 'ABC123' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Not connected/i);
  });

  it('resolves cleanly when server invokes acknowledgement callback', async () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn((_event, _payload, cb) => {
        cb({ success: true, roomId: 'K7P4M2' });
      }),
    } as unknown as Socket;

    const res = await emitWithAck<{ success: boolean; roomId?: string }>(
      mockSocket,
      'create-room',
      { username: 'Alice', avatar: '🦊' },
      500
    );

    expect(res.success).toBe(true);
    expect(res.roomId).toBe('K7P4M2');
  });

  it('times out safely when server never sends an acknowledgement', async () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn(), // Never invokes callback
    } as unknown as Socket;

    const res = await emitWithAck(mockSocket, 'play-card', { roomId: 'K7P4M2' }, 60);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/did not respond in time/i);
  });
});
