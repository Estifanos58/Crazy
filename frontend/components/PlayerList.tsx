import React from 'react';
import type { Player } from '@/types/game.types';
import { Crown, Users } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  currentUserId?: string;
}

export default function PlayerList({ players, currentUserId }: PlayerListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-cyber-primary mb-4">
        <Users size={20} />
        <h3 className="font-semibold tracking-wider uppercase">Players ({players.length})</h3>
      </div>
      
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
              player.id === currentUserId
                ? 'bg-cyber-primary/20 border-cyber-primary shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{player.avatar}</span>
              <div>
                <p className="font-medium text-white">
                  {player.username}
                  {player.id === currentUserId && (
                    <span className="text-xs text-cyber-primary ml-2 font-mono border border-cyber-primary/50 px-1 rounded">YOU</span>
                  )}
                </p>
                {player.isCreator && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
                    <Crown size={14} />
                    <span>HOST</span>
                  </div>
                )}
              </div>
            </div>
            
            {player.cardCount > 0 && (
              <div className="text-sm font-mono text-cyber-secondary">
                {player.cardCount} CARDS
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
