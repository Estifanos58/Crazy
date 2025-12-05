import React from 'react';
import { motion } from 'framer-motion';

interface SuitSelectionModalProps {
  isOpen: boolean;
  onSelect: (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades') => void;
}

const SUITS = [
  { name: 'hearts', symbol: '♥', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' },
  { name: 'diamonds', symbol: '♦', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' },
  { name: 'clubs', symbol: '♣', color: 'text-blue-500', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500' },
  { name: 'spades', symbol: '♠', color: 'text-blue-500', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500' },
] as const;

export default function SuitSelectionModal({ isOpen, onSelect }: SuitSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-cyber-dark border-2 border-cyber-primary rounded-xl p-4 sm:p-8 shadow-[0_0_50px_rgba(0,243,255,0.3)] max-w-md w-full mx-4"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-4 sm:mb-6 font-mono">
          <span className="text-cyber-primary">SELECT</span> SUIT
        </h2>
        
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {SUITS.map((suit) => (
            <motion.button
              key={suit.name}
              onClick={() => onSelect(suit.name as any)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`${suit.bgColor} ${suit.borderColor} border-2 rounded-lg p-4 sm:p-8 flex flex-col items-center justify-center gap-2 sm:gap-3 hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all`}
            >
              <span className={`text-4xl sm:text-6xl ${suit.color} drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`}>
                {suit.symbol}
              </span>
              <span className="text-white font-mono uppercase text-xs sm:text-sm tracking-wider">
                {suit.name}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
