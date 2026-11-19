'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface JoinGameModalProps {
  onJoin: (roomId: string) => void;
  onCancel: () => void;
}

function extractRoomId(rawInput: string): string {
  const trimmed = rawInput.trim();
  const urlMatch = trimmed.match(/\/(?:room|game)\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed.replace(/\s+/g, '').toUpperCase();
}

export default function JoinGameModal({ onJoin, onCancel }: JoinGameModalProps) {
  const [input, setInput] = useState('');
  const parsedCode = extractRoomId(input);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedCode) {
      onJoin(parsedCode);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="join-room-code" className="block text-sm font-medium text-ivory-200 mb-2">
          Room Code or Invite Link
        </label>
        <input
          type="text"
          id="join-room-code"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-field font-mono text-center text-lg tracking-widest uppercase"
          placeholder="e.g. K7P4M2"
          autoFocus
          required
        />
        <p className="mt-2 text-xs text-ivory-500">
          Enter the 6-character code shared by the host, or paste the full room invite URL.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={!parsedCode} className="flex-1 btn-primary">
          <span>Continue</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
