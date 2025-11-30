'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { toast } from 'sonner';

export function ConnectionManager() {
  const { connect, isConnected } = useGameStore();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Only initialize connection once
    if (!hasInitialized) {
      connect();
      setHasInitialized(true);
    }
  }, [connect, hasInitialized]);

  useEffect(() => {
    let reconnectToastId: string | number | undefined;

    if (!isConnected && hasInitialized) {
      // Show disconnection toast
      reconnectToastId = toast.loading('Reconnecting to server...', {
        duration: Infinity,
      });
    } else if (isConnected && reconnectToastId) {
      // Dismiss reconnection toast when connected
      toast.dismiss(reconnectToastId);
      toast.success('Connected to server');
    }

    // Handle online/offline events
    const handleOnline = () => {
      console.log('📡 Network online');
      if (!isConnected) {
        connect();
      }
    };

    const handleOffline = () => {
      console.log('📡 Network offline');
      toast.error('Network connection lost', {
        duration: 3000,
      });
    };

    // Handle visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        console.log('👁️ Tab focused, checking connection');
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
  }, [isConnected, connect, hasInitialized]);

  // Connection indicator
  return (
    <div className="fixed top-4 right-4 z-50">
      {!isConnected && hasInitialized && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500 rounded-lg backdrop-blur-md animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-sm text-red-200">Reconnecting...</span>
        </div>
      )}
    </div>
  );
}
