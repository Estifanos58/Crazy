import React, { useState } from 'react';

interface Avatar {
  id: string;
  emoji: string;
  label: string;
}

const AVATARS: Avatar[] = [
  { id: '1', emoji: '😀', label: 'Happy' },
  { id: '2', emoji: '😎', label: 'Cool' },
  { id: '3', emoji: '🤖', label: 'Robot' },
  { id: '4', emoji: '👻', label: 'Ghost' },
  { id: '5', emoji: '🦄', label: 'Unicorn' },
  { id: '6', emoji: '🐶', label: 'Dog' },
  { id: '7', emoji: '🐱', label: 'Cat' },
  { id: '8', emoji: '🦊', label: 'Fox' },
  { id: '9', emoji: '🐼', label: 'Panda' },
  { id: '10', emoji: '🐯', label: 'Tiger' },
  { id: '11', emoji: '🦁', label: 'Lion' },
  { id: '12', emoji: '🐸', label: 'Frog' },
];

interface UserInfoModalProps {
  onSubmit: (username: string, avatar: string) => void;
  isJoining?: boolean;
  isLoading?: boolean;
  initialUsername?: string;
  initialAvatar?: string;
}

export default function UserInfoModal({ 
  onSubmit, 
  isJoining = false, 
  isLoading = false,
  initialUsername = '',
  initialAvatar = AVATARS[0].emoji
}: UserInfoModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && !isLoading) {
      onSubmit(username.trim(), selectedAvatar);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300">
        {isJoining ? 'Join the game room' : 'Create a new game room'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-cyber-primary mb-2">
            USERNAME
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-cyber-black/50 border border-cyber-primary/30 rounded-lg text-white focus:ring-2 focus:ring-cyber-primary focus:border-transparent outline-none transition-all placeholder-gray-500"
            placeholder="ENTER_CODENAME"
            maxLength={20}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-cyber-primary mb-3">
            SELECT AVATAR
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedAvatar(avatar.emoji)}
                className={`text-4xl flex items-center justify-center p-3 rounded-lg transition-all hover:scale-110 ${
                  selectedAvatar === avatar.emoji
                    ? 'bg-cyber-primary/20 ring-2 ring-cyber-primary scale-110'
                    : 'bg-cyber-black/30 hover:bg-cyber-primary/10'
                }`}
                title={avatar.label}
              >
                {avatar.emoji}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full btn-primary flex items-center justify-center gap-2"
          disabled={!username.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-cyber-primary border-t-transparent rounded-full" />
              <span>PROCESSING...</span>
            </>
          ) : (
            <span>{isJoining ? 'JOIN GAME' : 'CREATE ROOM'}</span>
          )}
        </button>
      </form>
    </div>
  );
}
