import React from 'react';
import type { Card as CardType } from '@/types/game.types';
import CardComponent from './Card';

interface CardHandProps {
  cards: CardType[];
  selectedCards?: CardType[];
  onCardClick?: (card: CardType) => void;
  disabled?: boolean;
}

export default function CardHand({ cards, selectedCards = [], onCardClick, disabled = false }: CardHandProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center p-4">
      {cards.map((card) => (
        <CardComponent
          key={card.id}
          card={card}
          isSelected={selectedCards.some(c => c.id === card.id)}
          onClick={onCardClick ? () => onCardClick(card) : undefined}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
