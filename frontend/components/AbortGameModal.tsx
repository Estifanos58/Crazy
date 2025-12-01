'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface AbortGameModalProps {
  isOpen: boolean;
  isCreator: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AbortGameModal({ isOpen, isCreator, onConfirm, onCancel }: AbortGameModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative glass-panel p-6 max-w-md w-full border-2 border-red-500/30 shadow-[0_0_30px_rgba(255,0,0,0.3)]"
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2
              }}
              className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center"
            >
              <AlertTriangle className="text-red-500" size={32} />
            </motion.div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {isCreator ? 'TERMINATE GAME?' : 'LEAVE GAME?'}
          </h2>

          {/* Message */}
          <p className="text-gray-300 text-center mb-6">
            {isCreator ? (
              <>
                <span className="text-red-400 font-semibold">Warning:</span> Terminating the game will{' '}
                <span className="text-red-400 font-semibold">end it for all players</span> and delete the room permanently.
                This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to leave this game? Other players will be notified of your departure.
              </>
            )}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-all border border-white/20"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-all shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_30px_rgba(255,0,0,0.5)]"
            >
              {isCreator ? 'Terminate' : 'Leave'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
