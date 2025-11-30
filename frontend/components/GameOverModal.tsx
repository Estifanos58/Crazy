import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Award, RotateCcw } from 'lucide-react';

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
}

const RANK_COLORS = [
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-500', icon: Trophy },
  { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-400', icon: Medal },
  { bg: 'bg-amber-700/20', border: 'border-amber-700', text: 'text-amber-700', icon: Award },
];

export default function GameOverModal({ isOpen, rankings, onPlayAgain }: GameOverModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="bg-cyber-dark border-2 border-cyber-primary rounded-xl p-8 shadow-[0_0_80px_rgba(0,243,255,0.4)] max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="text-center mb-8"
        >
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
          <h2 className="text-4xl font-black text-white mb-2 font-mono">
            <span className="text-cyber-primary">GAME</span> OVER
          </h2>
          <p className="text-gray-400 text-sm uppercase tracking-widest">Final Rankings</p>
        </motion.div>

        {/* Rankings */}
        <div className="space-y-3 mb-8">
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
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`${rankStyle.bg} ${rankStyle.border} border-2 rounded-lg p-4 flex items-center justify-between hover:scale-105 transition-transform`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${rankStyle.bg} ${rankStyle.border} border flex items-center justify-center`}>
                      <span className={`text-2xl font-bold ${rankStyle.text}`}>
                        {index + 1}
                      </span>
                    </div>
                    
                    <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                      {player.avatar}
                    </span>
                    
                    <div>
                      <p className="text-xl font-bold text-white">{player.username}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        {index === 0 ? '🏆 Winner' : `${index + 1}${getRankSuffix(index + 1)} Place`}
                      </p>
                    </div>
                  </div>

                  {index < 3 && (
                    <Icon className={`w-8 h-8 ${rankStyle.text} drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Play Again Button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 + rankings.length * 0.1 }}
          onClick={onPlayAgain}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-3"
        >
          <RotateCcw size={24} />
          <span>PLAY AGAIN</span>
        </motion.button>
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
