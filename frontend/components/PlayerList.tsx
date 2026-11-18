'use client';

import React, { memo } from 'react';
import { Crown, Users } from 'lucide-react';
import type { Player } from '@/types/game.types';

interface PlayerListProps {
  players: Player[];
  currentUserId?: string;
  currentTurn?: string | null;
  showEmptySeats?: boolean;
  minSeats?: number;
}

const PlayerList = memo(function PlayerList({
  players,
  currentUserId,
  currentTurn,
  showEmptySeats = false,
  minSeats = 2,
}: PlayerListProps) {
  const emptySeatCount = showEmptySeats ? Math.max(0, minSeats - players.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-ivory-200">
          <Users className="h-4 w-4 text-brass-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-300">
            Seated Players
          </h3>
        </div>
        <span className="font-mono text-xs text-ivory-400">{players.length} / 8</span>
      </div>

      <ul className="space-y-2.5">
        {players.map((player) => {
          const isMe = Boolean(currentUserId && player.id === currentUserId);
          const isTurn = Boolean(currentTurn && player.id === currentTurn);
          const isOnline = player.connected !== false;

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                isTurn
                  ? 'border-brass-500 bg-brass-500/10'
                  : isMe
                  ? 'border-ivory-300/30 bg-parlor-elevated'
                  : 'border-parlor-border bg-parlor-bg/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-parlor-elevated border border-parlor-border text-xl">
                  <span aria-hidden="true">{player.avatar}</span>
                  <span
                    title={isOnline ? 'Connected' : 'Reconnecting'}
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-parlor-surface ${
                      isOnline ? 'bg-jade-400' : 'bg-ivory-500'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate font-medium text-sm text-ivory-100">
                      {player.username}
                    </span>
                    {isMe && (
                      <span className="rounded-md bg-parlor-bg px-1.5 py-0.5 text-[11px] font-medium text-ivory-300 border border-parlor-border">
                        You
                      </span>
                    )}
                    {isTurn && (
                      <span className="rounded-md bg-brass-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-brass-300">
                        Active Turn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs text-ivory-400">
                    {player.isCreator && (
                      <span className="inline-flex items-center gap-1 text-brass-400 font-medium">
                        <Crown className="h-3 w-3" aria-hidden="true" />
                        Host
                      </span>
                    )}
                    {!isOnline && <span className="text-ivory-500">Disconnected</span>}
                  </div>
                </div>
              </div>

              {player.cardCount > 0 && (
                <span className="shrink-0 rounded-lg border border-parlor-border bg-parlor-bg px-2.5 py-1 font-mono text-xs font-medium text-ivory-200">
                  {player.cardCount} {player.cardCount === 1 ? 'card' : 'cards'}
                </span>
              )}
            </li>
          );
        })}

        {Array.from({ length: emptySeatCount }).map((_, idx) => (
          <li
            key={`empty-${idx}`}
            className="flex items-center justify-between rounded-xl border border-dashed border-parlor-border px-3.5 py-3 text-sm text-ivory-500"
          >
            <span>Open seat — share room code to invite a player</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default PlayerList;
