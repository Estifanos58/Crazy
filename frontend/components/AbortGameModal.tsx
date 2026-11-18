'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface AbortGameModalProps {
  isOpen: boolean;
  isCreator: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AbortGameModal({
  isOpen,
  isCreator,
  isLoading = false,
  onConfirm,
  onCancel,
}: AbortGameModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={isCreator ? 'End Match for Everyone?' : 'Leave This Table?'}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-crimson-500/35 bg-crimson-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-crimson-400 mt-0.5" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-ivory-200">
            {isCreator
              ? 'As the host, ending this match will close the room for all seated players. This cannot be undone.'
              : 'You will be removed from the active match and other players will continue without you.'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 btn-secondary"
          >
            Stay at Table
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 btn-danger"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>{isCreator ? 'End Room' : 'Leave Match'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
