'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import Modal from './Modal';

interface QuickRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickRulesModal({ isOpen, onClose }: QuickRulesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Table Reference"
      description="Quick summary of standard Crazy card rules."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4 text-sm text-ivory-300">
        <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-4 space-y-2">
          <h3 className="font-semibold text-ivory-100">Core Play</h3>
          <p>
            Match the top card&apos;s <strong className="text-ivory-100">suit</strong> or{' '}
            <strong className="text-ivory-100">rank</strong>. If you cannot play, draw 1 card (your
            turn stays so you can play it), or pass after drawing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-3.5">
            <p className="font-semibold text-ivory-100">A♠ &amp; 2s — Punishment</p>
            <p className="mt-1 text-xs text-ivory-400">
              A♠ adds +5 cards; any 2 adds +2 cards. Stack matching 2s or A♠ on 2♠, or take the
              penalty cards.
            </p>
          </div>
          <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-3.5">
            <p className="font-semibold text-ivory-100">5 — Reverse</p>
            <p className="mt-1 text-xs text-ivory-400">
              Reverses turn order. In a 2-player match, Reverse acts as a Skip so you go again.
            </p>
          </div>
          <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-3.5">
            <p className="font-semibold text-ivory-100">7 — Skip &amp; Multi-Drop</p>
            <p className="mt-1 text-xs text-ivory-400">
              Single 7 skips the next player. Include a 7 to drop multiple cards of the same suit
              together.
            </p>
          </div>
          <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-3.5">
            <p className="font-semibold text-ivory-100">J &amp; 8 — Change Suit</p>
            <p className="mt-1 text-xs text-ivory-400">
              Play on any non-punishment turn to pick a new suit. Immediate next player cannot
              change suit consecutively.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 p-4 space-y-1.5">
          <h3 className="font-semibold text-ivory-100">Blunders &amp; Calling Crazy</h3>
          <p className="text-xs text-ivory-400">
            Playing an illegal card opens a 5-second revert window and an 8-second opponent
            challenge window. Call <strong className="text-ivory-200">Crazy</strong> before the
            player reverts to penalize them!
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/help"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brass-400 hover:text-brass-300"
          >
            <span>Open full rules guide</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <button type="button" onClick={onClose} className="btn-secondary py-2">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
