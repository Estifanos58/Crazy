'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Undo2, Timer } from 'lucide-react';

interface BlunderModalProps {
  isOpen: boolean;
  reason: string;
  timeLeft: number;
  onRevert: () => void;
  onClose: () => void;
}

export default function BlunderModal({
  isOpen,
  reason,
  timeLeft,
  onRevert,
  onClose,
}: BlunderModalProps) {
  const [countdown, setCountdown] = useState(timeLeft);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(timeLeft);
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  const progress = (countdown / timeLeft) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-gradient-to-br from-red-900/40 to-gray-900/40 border-2 border-red-500/50 rounded-2xl p-6 backdrop-blur-xl shadow-2xl"
          >
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
                className="p-4 bg-red-500/20 rounded-full"
              >
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </motion.div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-red-400 mb-2">
              Invalid Move!
            </h2>

            {/* Reason */}
            <p className="text-center text-gray-300 mb-6">
              {reason}
            </p>

            {/* Timer */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Timer className="w-5 h-5 text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-400">
                  {countdown}s
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-red-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Warning Text */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-300 text-center">
                ⚠️ Other players can call "Crazy" on you!
                <br />
                <span className="text-xs text-gray-400">
                  If challenged, you'll draw 2 punishment cards
                </span>
              </p>
            </div>

            {/* Revert Button */}
            <button
              onClick={onRevert}
              disabled={countdown === 0}
              className={`w-full py-3 rounded-lg font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                countdown === 0
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 hover:scale-105 active:scale-95 shadow-lg hover:shadow-yellow-500/50'
              }`}
            >
              <Undo2 className="w-5 h-5" />
              Revert Move
            </button>

            {countdown === 0 && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-red-400 mt-3 text-sm"
              >
                Too late! Waiting for challenge...
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
