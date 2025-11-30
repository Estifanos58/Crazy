import React from 'react';
import type { Card as CardType } from '@/types/game.types';
import CardComponent from './Card';

interface CardHandProps {
  cards: CardType[];
  onCardClick?: (card: CardType) => void;
  disabled?: boolean;
}

export default function CardHand({ cards, onCardClick, disabled = false }: CardHandProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center p-4">
      {cards.map((card) => (
        <CardComponent
          key={card.id}
          card={card}
          onClick={onCardClick ? () => onCardClick(card) : undefined}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
