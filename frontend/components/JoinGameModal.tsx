import React, { useState } from 'react';
import { QrCode, Keyboard, ArrowRight, ScanLine } from 'lucide-react';

interface JoinGameModalProps {
  onJoin: (roomId: string) => void;
  onCancel: () => void;
}

export default function JoinGameModal({ onJoin, onCancel }: JoinGameModalProps) {
  const [mode, setMode] = useState<'select' | 'scan' | 'type'>('select');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoin(roomId.trim());
    }
  };

  if (mode === 'select') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setMode('scan')}
          className="w-full btn-primary flex items-center justify-center gap-3 group py-4"
        >
          <QrCode size={24} className="group-hover:scale-110 transition-transform" />
          <span>SCAN QR CODE</span>
        </button>
        
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink-0 mx-4 text-gray-500 text-xs">OR</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        <button
          onClick={() => setMode('type')}
          className="w-full btn-secondary flex items-center justify-center gap-3 group py-4"
        >
          <Keyboard size={24} className="group-hover:scale-110 transition-transform" />
          <span>ENTER ROOM ID</span>
        </button>
      </div>
    );
  }

  if (mode === 'scan') {
    return (
      <div className="space-y-6 text-center">
        <div className="aspect-square bg-black/50 rounded-lg border-2 border-cyber-primary/30 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-cyber-primary/20 to-transparent animate-scan"></div>
            <ScanLine size={48} className="text-cyber-primary animate-pulse" />
            <p className="absolute bottom-4 text-xs text-cyber-primary">CAMERA FEED SIMULATION</p>
        </div>
        <p className="text-sm text-gray-400">Point your camera at the host's QR code</p>
        <button
          onClick={() => setMode('select')}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Back to options
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="roomId" className="block text-sm font-medium text-cyber-primary mb-2">
            ROOM ID
          </label>
          <input
            type="text"
            id="roomId"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyber-primary transition-colors font-mono text-center text-xl tracking-widest uppercase"
            placeholder="XXXX-XXXX"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={!roomId.trim()}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>JOIN PROTOCOL</span>
          <ArrowRight size={18} />
        </button>
      </form>
      
      <button
        onClick={() => setMode('select')}
        className="w-full text-sm text-gray-500 hover:text-white transition-colors"
      >
        Back to options
      </button>
    </div>
  );
}
