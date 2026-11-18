'use client';

import React, { memo } from 'react';
import type { Card as CardType } from '@/types/game.types';
import CardComponent from './Card';

interface CardHandProps {
  cards: CardType[];
  selectedCards?: CardType[];
  onCardClick?: (card: CardType) => void;
  disabled?: boolean;
}

const CardHand = memo(function CardHand({
  cards,
  selectedCards = [],
  onCardClick,
  disabled = false,
}: CardHandProps) {
  if (cards.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-ivory-400">
        No cards remaining in your hand.
      </div>
    );
  }

  // Tighter overlap when holding larger hands on desktop while remaining readable on mobile
  const overlapClass =
    cards.length > 10
      ? '-ml-6 sm:-ml-7 md:-ml-8 first:ml-0'
      : cards.length > 7
      ? '-ml-4 sm:-ml-5 first:ml-0'
      : 'ml-1.5 sm:ml-2 first:ml-0';

  return (
    <div
      role="group"
      aria-label="Your playing cards"
      className="w-full overflow-x-auto pb-2 pt-5 px-2"
    >
      <div className="flex flex-wrap sm:flex-nowrap items-end justify-center gap-y-3 min-w-fit mx-auto px-2">
        {cards.map((card) => {
          const isSelected = selectedCards.some((c) => c.id === card.id);
          return (
            <div key={card.id} className={`shrink-0 ${overlapClass}`}>
              <CardComponent
                card={card}
                isSelected={isSelected}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
                disabled={disabled}
                size="md"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CardHand;
