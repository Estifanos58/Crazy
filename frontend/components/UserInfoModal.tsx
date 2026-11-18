'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  { id: '1', emoji: '🦊', label: 'Fox' },
  { id: '2', emoji: '🦉', label: 'Owl' },
  { id: '3', emoji: '🦁', label: 'Lion' },
  { id: '4', emoji: '🐻', label: 'Bear' },
  { id: '5', emoji: '🐺', label: 'Wolf' },
  { id: '6', emoji: '🦅', label: 'Eagle' },
  { id: '7', emoji: '🐱', label: 'Cat' },
  { id: '8', emoji: '🐶', label: 'Dog' },
  { id: '9', emoji: '🐼', label: 'Panda' },
  { id: '10', emoji: '🐯', label: 'Tiger' },
  { id: '11', emoji: '🐸', label: 'Frog' },
  { id: '12', emoji: '🐙', label: 'Octopus' },
];

interface UserInfoModalProps {
  onSubmit: (username: string, avatar: string) => void;
  submitLabel?: string;
  isJoining?: boolean;
  isLoading?: boolean;
  initialUsername?: string;
  initialAvatar?: string;
}

export default function UserInfoModal({
  onSubmit,
  submitLabel,
  isJoining = false,
  isLoading = false,
  initialUsername = '',
  initialAvatar = AVATARS[0].emoji,
}: UserInfoModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar || AVATARS[0].emoji);

  useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername]);

  useEffect(() => {
    if (initialAvatar) {
      setSelectedAvatar(initialAvatar);
    }
  }, [initialAvatar]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed, selectedAvatar);
    }
  };

  const buttonText = submitLabel || (isJoining ? 'Join Room' : 'Create Room');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="player-username" className="block text-sm font-medium text-ivory-200 mb-2">
          Display Name
        </label>
        <input
          type="text"
          id="player-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input-field"
          placeholder="Enter your name"
          maxLength={24}
          autoFocus
          required
        />
        <p className="mt-1.5 text-xs text-ivory-500">Shown to other players seated at your table.</p>
      </div>

      <div>
        <span className="block text-sm font-medium text-ivory-200 mb-2.5">Choose an Avatar</span>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Player avatar">
          {AVATARS.map((avatar) => {
            const isSelected = selectedAvatar === avatar.emoji;
            return (
              <button
                key={avatar.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={avatar.label}
                onClick={() => setSelectedAvatar(avatar.emoji)}
                className={`flex h-12 items-center justify-center rounded-xl border text-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 ${
                  isSelected
                    ? 'border-brass-500 bg-brass-500/15'
                    : 'border-parlor-border bg-parlor-bg hover:bg-parlor-elevated'
                }`}
              >
                <span aria-hidden="true">{avatar.emoji}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        className="w-full btn-primary"
        disabled={!username.trim() || isLoading}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span>{isLoading ? 'Working…' : buttonText}</span>
      </button>
    </form>
  );
}
