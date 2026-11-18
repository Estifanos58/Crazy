'use client';

import { useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useGameStore } from '@/lib/store';

export function ConnectionManager() {
  const { connect, isConnected, isRestoringSession } = useGameStore();
  const initializedRef = useRef(false);
  const hadConnectedOnceRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      connect();
    }
  }, [connect]);

  useEffect(() => {
    if (isConnected) {
      if (hadConnectedOnceRef.current) {
        toast.success('Reconnected to game server', { id: 'socket-reconnect', duration: 2500 });
      }
      hadConnectedOnceRef.current = true;
    }
  }, [isConnected]);

  useEffect(() => {
    const handleOnline = () => {
      if (!useGameStore.getState().isConnected) {
        connect();
      }
    };

    const handleOffline = () => {
      toast.error('Network connection lost', { id: 'network-offline', duration: 4000 });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !useGameStore.getState().isConnected) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect]);

  if (isConnected && !isRestoringSession) {
    return null;
  }

  if (!hadConnectedOnceRef.current && !isRestoringSession) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border border-crimson-500/40 bg-parlor-elevated px-4 py-2.5 text-xs font-medium text-ivory-100 shadow-surface"
    >
      <WifiOff className="h-4 w-4 text-crimson-400 shrink-0" aria-hidden="true" />
      <span>{isRestoringSession ? 'Syncing match state…' : 'Reconnecting to server…'}</span>
    </div>
  );
}
