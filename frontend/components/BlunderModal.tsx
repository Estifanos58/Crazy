'use client';

import React from 'react';
import { AlertTriangle, Clock, Loader2, Undo2 } from 'lucide-react';
import Modal from './Modal';

interface BlunderModalProps {
  isOpen: boolean;
  reason: string;
  timeLeft: number;
  totalTime?: number;
  onRevert: () => void;
  isLoading?: boolean;
}

export default function BlunderModal({
  isOpen,
  reason,
  timeLeft,
  totalTime = 5,
  onRevert,
  isLoading = false,
}: BlunderModalProps) {
  const safeTotal = Math.max(1, totalTime);
  const progressPct = Math.max(0, Math.min(100, (timeLeft / safeTotal) * 100));
  const canRevert = timeLeft > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Illegal Move Detected"
      dismissible={false}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-crimson-500/35 bg-crimson-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-crimson-400 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-ivory-100">{reason}</p>
            <p className="text-ivory-400">
              Revert before another player calls Crazy to avoid drawing penalty cards.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-ivory-400">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {canRevert ? 'Revert window remaining' : 'Revert window closed'}
            </span>
            <span className="font-mono text-sm font-semibold text-brass-300">
              {Math.max(0, timeLeft)}s
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={Math.max(0, timeLeft)}
            aria-valuemin={0}
            aria-valuemax={safeTotal}
            className="h-2 w-full overflow-hidden rounded-full bg-parlor-bg border border-parlor-border"
          >
            <div
              className="h-full bg-brass-500 transition-[width] duration-700 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRevert}
          disabled={!canRevert || isLoading}
          className="w-full btn-primary"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isLoading ? 'Reverting…' : 'Revert Move'}</span>
        </button>

        {!canRevert && (
          <p className="text-center text-xs text-ivory-400">
            Waiting for the server timer or an opponent challenge to resolve…
          </p>
        )}
      </div>
    </Modal>
  );
}
