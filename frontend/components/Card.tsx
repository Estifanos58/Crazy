'use client';

import React, { memo } from 'react';
import type { Card, Suit } from '@/types/game.types';

export interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_NAMES: Record<Suit, string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
};

const RANK_NAMES: Record<string, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
};

const SIZE_CLASSES = {
  sm: 'w-14 h-20 rounded-lg',
  md: 'w-[4.5rem] h-[6.5rem] sm:w-[5.25rem] sm:h-[7.5rem] md:w-24 md:h-[8.5rem] rounded-xl',
  lg: 'w-24 h-[8.5rem] sm:w-28 sm:h-40 rounded-xl',
};

const CORNER_RANK_CLASSES = {
  sm: 'text-xs leading-none',
  md: 'text-sm sm:text-base leading-none',
  lg: 'text-base sm:text-lg leading-none',
};

const CORNER_SUIT_CLASSES = {
  sm: 'text-[10px] leading-none',
  md: 'text-xs sm:text-sm leading-none',
  lg: 'text-sm sm:text-base leading-none',
};

const CENTER_SUIT_CLASSES = {
  sm: 'text-xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-5xl',
};

const CardComponent = memo(function CardComponent({
  card,
  onClick,
  disabled = false,
  isSelected = false,
  size = 'md',
  interactive = Boolean(onClick),
  className = '',
}: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const inkColor = isRed ? 'text-crimson-600' : 'text-[#181C1A]';
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const isAceOfSpades = card.rank === 'A' && card.suit === 'spades';
  const isFaceCard = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';

  const rankLabel = RANK_NAMES[card.rank] || card.rank;
  const ariaLabel = `${rankLabel} of ${SUIT_NAMES[card.suit]}${isSelected ? ', selected' : ''}`;

  const baseClasses = `
    relative select-none bg-ivory-100 border text-left transition-all duration-150
    ${SIZE_CLASSES[size]}
    ${isSelected ? 'border-brass-500 ring-2 ring-brass-400 -translate-y-3.5 sm:-translate-y-4 shadow-card-lifted z-20' : 'border-ivory-300 shadow-card'}
    ${interactive && !disabled ? 'cursor-pointer hover:-translate-y-2 hover:shadow-card-lifted hover:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-parlor-bg' : ''}
    ${disabled ? 'opacity-65 cursor-not-allowed' : ''}
    ${className}
  `;

  const innerContent = (
    <>
      {/* Subtle inner frame */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[4px] rounded-[7px] border ${
          isAceOfSpades ? 'border-brass-500/45' : 'border-ivory-300/60'
        }`}
      />

      {/* Top-left corner index */}
      <span
        aria-hidden="true"
        className={`absolute top-1.5 left-2 flex flex-col items-center font-bold ${inkColor}`}
      >
        <span className={`font-sans tracking-tight ${CORNER_RANK_CLASSES[size]}`}>
          {card.rank}
        </span>
        <span className={CORNER_SUIT_CLASSES[size]}>{suitSymbol}</span>
      </span>

      {/* Center emblem */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex flex-col items-center justify-center ${inkColor}`}
      >
        {isFaceCard ? (
          <span className="flex flex-col items-center justify-center">
            <span className="font-display text-xl sm:text-2xl font-semibold leading-none">
              {card.rank}
            </span>
            <span className="text-sm sm:text-base leading-none mt-0.5 opacity-85">
              {suitSymbol}
            </span>
          </span>
        ) : (
          <span
            className={`leading-none ${CENTER_SUIT_CLASSES[size]} ${
              isAceOfSpades ? 'scale-110' : ''
            }`}
          >
            {suitSymbol}
          </span>
        )}
      </span>

      {/* Bottom-right inverted corner index */}
      <span
        aria-hidden="true"
        className={`absolute bottom-1.5 right-2 flex flex-col items-center font-bold rotate-180 ${inkColor}`}
      >
        <span className={`font-sans tracking-tight ${CORNER_RANK_CLASSES[size]}`}>
          {card.rank}
        </span>
        <span className={CORNER_SUIT_CLASSES[size]}>{suitSymbol}</span>
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brass-500 text-[11px] font-bold text-parlor-bg shadow"
        >
          ✓
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        className={baseClasses}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel} className={baseClasses}>
      {innerContent}
    </div>
  );
});

export interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const CardBack = memo(function CardBack({
  size = 'md',
  label,
  count,
  onClick,
  disabled = false,
  className = '',
}: CardBackProps) {
  const classes = `
    relative select-none card-back-pattern border border-brass-500/45 shadow-card transition-all duration-150
    ${SIZE_CLASSES[size]}
    ${onClick && !disabled ? 'cursor-pointer hover:-translate-y-1 hover:border-brass-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-parlor-felt' : ''}
    ${disabled ? 'opacity-65 cursor-not-allowed' : ''}
    ${className}
  `;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] rounded-[7px] border border-brass-500/35 flex items-center justify-center"
      >
        <span className="h-7 w-7 rounded-full border border-brass-500/40 bg-parlor-bg/70 flex items-center justify-center font-display text-xs text-brass-400">
          ♠
        </span>
      </span>
      {typeof count === 'number' && (
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full border border-parlor-border bg-parlor-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-ivory-200 shadow">
          {count}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label || 'Draw card from deck'}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <div role="img" aria-label={label || 'Face-down card'} className={classes}>
      {inner}
    </div>
  );
});

export default CardComponent;
