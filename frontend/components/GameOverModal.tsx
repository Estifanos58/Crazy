'use client';

import React from 'react';
import { Award, Loader2, LogOut, Medal, RotateCcw, Trophy } from 'lucide-react';
import Modal from './Modal';
import type { RankedPlayer } from '@/types/game.types';

interface GameOverModalProps {
  isOpen: boolean;
  rankings: RankedPlayer[];
  isCreator: boolean;
  currentPlayerId?: string | null;
  onPlayAgain: () => void;
  onExit: () => void;
  isLoading?: boolean;
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

export default function GameOverModal({
  isOpen,
  rankings,
  isCreator,
  currentPlayerId,
  onPlayAgain,
  onExit,
  isLoading = false,
}: GameOverModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Match Standings"
      description="Final order of finish for this round."
      dismissible={false}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-6">
        <ol className="space-y-2.5">
          {rankings.map((player, index) => {
            const place = player.rank || index + 1;
            const isWinner = place === 1;
            const isMe = Boolean(currentPlayerId && player.id === currentPlayerId);
            const Icon = place === 1 ? Trophy : place === 2 ? Medal : Award;

            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${
                  isWinner
                    ? 'border-brass-500/60 bg-brass-500/10'
                    : 'border-parlor-border bg-parlor-bg/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${
                      isWinner
                        ? 'border-brass-500 bg-brass-500/20 text-brass-300'
                        : 'border-parlor-border bg-parlor-elevated text-ivory-300'
                    }`}
                  >
                    {place}
                  </span>

                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {player.avatar}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ivory-100 text-sm sm:text-base">
                      {player.username}
                      {isMe && (
                        <span className="ml-2 text-xs font-normal text-ivory-400">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-ivory-400">
                      {isWinner ? 'Winner' : `${place}${getRankSuffix(place)} Place`}
                    </p>
                  </div>
                </div>

                {place <= 3 && (
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      place === 1
                        ? 'text-brass-400'
                        : place === 2
                        ? 'text-ivory-300'
                        : 'text-ivory-500'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>

        {!isCreator && (
          <p className="text-center text-xs text-ivory-400">
            Waiting for the room host to start another match, or you can leave the table below.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button type="button" onClick={onExit} className="flex-1 btn-secondary">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Leave Table</span>
          </button>

          {isCreator && (
            <button
              type="button"
              onClick={onPlayAgain}
              disabled={isLoading || rankings.length < 2}
              className="flex-1 btn-primary"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isLoading ? 'Starting…' : 'Play Again'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
