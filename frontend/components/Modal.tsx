'use client';

import React, { useEffect, useId, useRef } from 'react';
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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
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
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Move focus into modal on open and restore focus to trigger element on close
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const autoFocusEl = dialogEl.querySelector<HTMLElement>('[autofocus]');
      const focusables = getFocusableElements(dialogEl);
      const target = autoFocusEl || focusables[0] || dialogEl;
      target.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      const previousEl = previouslyFocusedRef.current;
      if (previousEl && document.contains(previousEl)) {
        previousEl.focus();
      }
    };
  }, [isOpen]);

  // Keyboard handling: Escape to dismiss + Tab / Shift+Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissible) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === 'Tab') {
        const dialogEl = dialogRef.current;
        if (!dialogEl) return;

        const focusables = getFocusableElements(dialogEl);
        if (focusables.length === 0) {
          event.preventDefault();
          dialogEl.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !dialogEl.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialogEl.contains(active)) {
          event.preventDefault();
          first.focus();
        }
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-parlor-border bg-parlor-surface p-6 sm:p-7 shadow-surface focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold text-ivory-100">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-ivory-400">
                {description}
              </p>
            )}
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
