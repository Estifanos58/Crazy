'use client';

import React from 'react';
import Modal from './Modal';
import type { Suit } from '@/types/game.types';

interface SuitSelectionModalProps {
  isOpen: boolean;
  onSelect: (suit: Suit) => void;
  onClose: () => void;
}

const SUIT_OPTIONS: { suit: Suit; label: string; symbol: string; isRed: boolean }[] = [
  { suit: 'hearts', label: 'Hearts', symbol: '♥', isRed: true },
  { suit: 'diamonds', label: 'Diamonds', symbol: '♦', isRed: true },
  { suit: 'clubs', label: 'Clubs', symbol: '♣', isRed: false },
  { suit: 'spades', label: 'Spades', symbol: '♠', isRed: false },
];

export default function SuitSelectionModal({
  isOpen,
  onSelect,
  onClose,
}: SuitSelectionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Declare Active Suit"
      description="Choose the suit the next player must follow."
      maxWidthClass="max-w-sm"
    >
      <div className="grid grid-cols-2 gap-3">
        {SUIT_OPTIONS.map((option) => (
          <button
            key={option.suit}
            type="button"
            onClick={() => onSelect(option.suit)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-ivory-300 bg-ivory-100 py-5 px-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brass-500 hover:ring-2 hover:ring-brass-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-parlor-surface"
          >
            <span
              aria-hidden="true"
              className={`text-4xl leading-none ${
                option.isRed ? 'text-crimson-600' : 'text-[#181C1A]'
              }`}
            >
              {option.symbol}
            </span>
            <span className="text-sm font-semibold text-[#181C1A]">{option.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
