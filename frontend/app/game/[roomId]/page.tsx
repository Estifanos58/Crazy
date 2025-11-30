'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import CardHand from '@/components/CardHand';
import PlayerList from '@/components/PlayerList';
import Background from '@/components/Background';
import { useGameStore } from '@/lib/store';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    socket,
    gameStarted,
    yourCards,
    players,
    currentTurn,
  } = useGameStore();

  useEffect(() => {
    if (!socket) {
      router.push('/');
    }
  }, [socket, router]);

  const isYourTurn = socket?.id === currentTurn;

  const handleCardClick = (card: any) => {
    if (isYourTurn) {
      console.log('Card clicked:', card);
      // TODO: Implement card play logic
    }
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game?')) {
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-8">
      <Background />
      
      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="glass-panel p-4 flex justify-between items-center">
          <button
            onClick={handleLeaveGame}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors hover:bg-white/10 px-4 py-2 rounded-lg"
          >
            <ArrowLeft size={20} />
            <span className="font-mono uppercase">Abort Mission</span>
          </button>
          
          <div className="text-center">
            <div className="flex items-center gap-3 justify-center mb-1">
              <span className="text-cyber-primary font-bold tracking-widest uppercase text-sm">Sector</span>
              <code className="bg-cyber-black/50 border border-cyber-primary/30 px-3 py-1 rounded text-lg font-mono text-white shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                {roomId}
              </code>
            </div>
            {isYourTurn && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-cyber-accent font-bold uppercase tracking-widest text-sm animate-pulse flex items-center justify-center gap-2"
              >
                <Zap size={14} /> YOUR TURN <Zap size={14} />
              </motion.div>
            )}
          </div>

          <div className="w-32 hidden md:block" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Game Board */}
            <div className="glass-panel p-6 relative overflow-hidden min-h-[400px] flex flex-col">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                <Shield className="text-cyber-secondary" size={20} />
                ACTIVE BATTLEFIELD
              </h2>
              
              <div className="flex-1 flex items-center justify-center relative z-10">
                <div className="w-full h-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center bg-cyber-black/20 backdrop-blur-sm">
                  <div className="text-center">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="text-6xl mb-4 opacity-50 grayscale"
                    >
                      🎴
                    </motion.div>
                    <p className="text-xl font-mono text-cyber-primary/80 uppercase tracking-wider">
                      {isYourTurn ? '>> AWAITING_INPUT <<' : '>> SYNCHRONIZING... <<'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Player Hand */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-cyber-primary">///</span> 
                YOUR HAND <span className="text-gray-500 text-sm font-mono">({yourCards.length})</span>
              </h2>
              <CardHand
                cards={yourCards}
                onCardClick={handleCardClick}
                disabled={!isYourTurn}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="glass-panel p-6 h-fit">
            <PlayerList players={players} currentUserId={socket?.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
