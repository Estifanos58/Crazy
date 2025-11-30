import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface WinnerToastProps {
  username: string;
  avatar: string;
  rank: number;
}

export default function WinnerToast({ username, avatar, rank }: WinnerToastProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500/20 to-cyber-primary/20 border-2 border-yellow-500 rounded-lg"
    >
      <Trophy className="w-8 h-8 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
      
      <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
        {avatar}
      </span>
      
      <div>
        <p className="text-lg font-bold text-white">{username}</p>
        <p className="text-sm text-yellow-500">
          {rank === 1 ? '🏆 Winner!' : `Finished ${rank}${getRankSuffix(rank)}`}
        </p>
      </div>
    </motion.div>
  );
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}
