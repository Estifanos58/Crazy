import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Trophy, Medal, Award, RotateCcw, LogOut } from 'lucide-react';

interface RankedPlayer {
  id: string;
  username: string;
  avatar: string;
  rank: number;
}

interface GameOverModalProps {
  isOpen: boolean;
  rankings: RankedPlayer[];
  onPlayAgain: () => void;
  onExit: () => void;
  isLoading?: boolean;
}

const RANK_COLORS = [
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-500', icon: Trophy },
  { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-400', icon: Medal },
  { bg: 'bg-amber-700/20', border: 'border-amber-700', text: 'text-amber-700', icon: Award },
];

export default function GameOverModal({ isOpen, rankings, onPlayAgain, onExit }: GameOverModalProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: shouldReduceMotion ? 0 : 0.6 }}
        className="bg-cyber-dark border-2 border-cyber-primary rounded-xl p-4 sm:p-8 shadow-[0_0_80px_rgba(0,243,255,0.4)] max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto will-change-transform"
      >
        {/* Header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.2, type: "spring" }}
          className="text-center mb-4 sm:mb-8"
        >
          <Trophy className="w-12 h-12 sm:w-20 sm:h-20 text-yellow-500 mx-auto mb-2 sm:mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-1 sm:mb-2 font-mono">
            <span className="text-cyber-primary">GAME</span> OVER
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-widest">Final Rankings</p>
        </motion.div>

        {/* Rankings */}
        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-8">
          <AnimatePresence>
            {rankings.map((player, index) => {
              const rankStyle = RANK_COLORS[index] || { 
                bg: 'bg-white/5', 
                border: 'border-white/10', 
                text: 'text-gray-400',
                icon: Award 
              };
              const Icon = rankStyle.icon;

              return (
                <motion.div
                  key={player.id}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.3 + index * 0.1 }}
                  className={`${rankStyle.bg} ${rankStyle.border} border-2 rounded-lg p-2 sm:p-4 flex items-center justify-between hover:scale-105 transition-transform will-change-transform`}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full ${rankStyle.bg} ${rankStyle.border} border flex items-center justify-center`}>
                      <span className={`text-lg sm:text-2xl font-bold ${rankStyle.text}`}>
                        {index + 1}
                      </span>
                    </div>
                    
                    <span className="text-2xl sm:text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                      {player.avatar}
                    </span>
                    
                    <div>
                      <p className="text-lg sm:text-xl font-bold text-white">{player.username}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
                        {index === 0 ? '🏆 Winner' : `${index + 1}${getRankSuffix(index + 1)} Place`}
                      </p>
                    </div>
                  </div>

                  {index < 3 && (
                    <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${rankStyle.text} drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}

          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 + rankings.length * 0.1 }}
          className="flex gap-4"
        >
          <button
            onClick={onExit}
            className="flex-1 btn-secondary py-4 text-lg flex items-center justify-center gap-3 border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={24} />
            <span>EXIT</span>
          </button>
          
          <motion.button
            onClick={onPlayAgain}
            whileHover={{ scale:   1  }}
            whileTap={{ scale:  1 }}
            className="flex-1 btn-primary py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            { (
              <div className="animate-spin h-6 w-6 border-2 border-cyber-primary border-t-transparent rounded-full" />
            ) }
            <span>{'PLAY AGAIN'}</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}
