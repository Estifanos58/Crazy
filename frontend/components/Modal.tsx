'use client';

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  dismissible?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  dismissible = true,
  maxWidthClass = 'max-w-md',
  children,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen || !dismissible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-parlor-border bg-parlor-surface p-6 sm:p-7 shadow-surface`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold text-ivory-100">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ivory-400">{description}</p>}
          </div>

          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-ivory-400 hover:bg-parlor-elevated hover:text-ivory-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
