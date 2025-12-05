import React, { memo } from 'react';
import type { Card } from '@/types/game.types';

interface CardComponentProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS = {
  hearts: 'text-cyber-warning drop-shadow-[0_0_5px_rgba(255,0,85,0.8)]',
  diamonds: 'text-cyber-warning drop-shadow-[0_0_5px_rgba(255,0,85,0.8)]',
  clubs: 'text-cyber-primary drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]',
  spades: 'text-cyber-primary drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]',
};

const CardComponent = memo(function CardComponent({ card, onClick, disabled = false, isSelected = false }: CardComponentProps) {
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative rounded-xl border transition-transform duration-300 will-change-transform
        w-16 h-24 sm:w-20 sm:h-32 md:w-24 md:h-36 flex flex-col items-center justify-center overflow-hidden
        ${!disabled && onClick 
          ? 'hover:scale-110 hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:border-cyber-primary cursor-pointer z-10' 
          : ''}
        ${isSelected ? '-translate-y-4 sm:-translate-y-6 shadow-[0_0_30px_rgba(0,243,255,0.6)] border-cyber-primary scale-105 z-20' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        bg-cyber-dark/90 backdrop-blur-md border-cyber-primary/30
      `}
    >
      {/* Tech Background Pattern */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-primary/20 to-transparent" />
      
      {/* Corner Accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-cyber-primary/50" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-cyber-primary/50" />

      {/* Card Content */}
      <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${suitColor} mb-1 font-mono`}>
        {card.rank}
      </div>
      <div className={`text-3xl sm:text-4xl md:text-5xl ${suitColor}`}>
        {suitSymbol}
      </div>

      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none motion-safe:animate-pulse" />
    </button>
  );
});

export default CardComponent;
