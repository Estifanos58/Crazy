'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Users, Zap, Globe, Smartphone, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import Modal from '@/components/Modal';
import UserInfoModal from '@/components/UserInfoModal';
import JoinGameModal from '@/components/JoinGameModal';
import { useGameStore } from '@/lib/store';
import Background from '@/components/Background';
import HolographicCard from '@/components/HolographicCard';
import FeatureCard from '@/components/FeatureCard';

export default function Home() {
  const router = useRouter();
  const [showGameSelect, setShowGameSelect] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showJoinGameModal, setShowJoinGameModal] = useState(false);
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create');
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { connect, setUserInfo, createRoom, joinRoom } = useGameStore();

  const handlePlayClick = () => {
    // Clear any previous game session
    sessionStorage.removeItem('crazy-game-state');
    setShowGameSelect(true);
  };

  const handleJoinClick = () => {
    // Clear any previous game session
    sessionStorage.removeItem('crazy-game-state');
    setShowJoinGameModal(true);
  };

  const handleJoinSubmit = (roomId: string) => {
    setTargetRoomId(roomId);
    setShowJoinGameModal(false);
    setJoinMode('join');
    setShowUserInfo(true);
  };

  const handleGameSelect = () => {
    setShowGameSelect(false);
    setShowModeSelect(true);
  };

  const handleModeSelect = (mode: 'single' | 'multi') => {
    if (mode === 'single') {
      alert('Single player mode coming soon!');
      return;
    }
    setJoinMode('create');
    setShowModeSelect(false);
    setShowUserInfo(true);
  };

  const handleUserInfoSubmit = async (username: string, avatar: string) => {
    setUserInfo(username, avatar);
    setIsLoading(true);

    try {
      if (joinMode === 'create') {
        const result = await createRoom();

        if (result.success && result.roomId) {
          router.push(`/room/${result.roomId}`);
        } else {
          alert('Failed to create room: ' + result.error);
          setIsLoading(false);
        }
      } else if (joinMode === 'join' && targetRoomId) {
        const result = await joinRoom(targetRoomId);

        if (result.success) {
          router.push(`/room/${targetRoomId}`);
        } else {
          alert('Failed to join room: ' + result.error);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col">
      <Background />

      {/* Hero Section */}
      <section className="relative z-10 flex-grow flex flex-col lg:flex-row items-center justify-center px-4 py-12 sm:py-20 lg:py-40 max-w-7xl mx-auto w-full gap-8 sm:gap-12 lg:gap-24">

        {/* Text Content */}
        <div className="flex-1 text-center lg:text-left space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-4 tracking-tighter mb-4">
              <span className="text-transparent px-2 sm:px-3 bg-clip-text bg-gradient-to-r from-cyber-primary via-white to-cyber-primary animate-pulse-glow">
                CRAZY
              </span>
              {/* <br />  */}
              <span className="text-white text-glow-purple">CARDS</span>
            </h1>
            <p className="text-base sm:text-xl lg:text-2xl text-gray-300 max-w-2xl mx-auto lg:mx-0 font-light tracking-wide">
              The Future of Multiplayer Card Gaming is Here.
              <span className="block text-cyber-primary mt-2 font-mono text-sm">
                // SYSTEM.READY // WAITING_FOR_PLAYER
              </span>
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start w-full sm:w-auto">
            <motion.button
              onClick={handlePlayClick}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.4 }}
              className="btn-primary text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6 shadow-[0_0_30px_rgba(0,243,255,0.3)] w-full sm:w-auto"
            >
              INITIALIZE GAME
            </motion.button>

            <motion.button
              onClick={handleJoinClick}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.5 }}
              className="btn-secondary text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6 w-full sm:w-auto"
            >
              JOIN GAME
            </motion.button>
            <motion.button
              onClick={() => router.push('/help')}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.6 }}
              className="btn-secondary text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <BookOpen size={24} />
              <span className='sm:block hidden'>HOW TO PLAY</span>
            </motion.button>
          </div>
        </div>

        {/* Visual Hook */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex-1 flex justify-center items-center"
        >
          <HolographicCard />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-12 sm:py-20 px-4 bg-cyber-black/50 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon={<Globe size={40} />}
              title="Real-Time Multiplayer"
              description="Instant connections. Zero lag. Play with friends anywhere in the world with our low-latency WebSocket infrastructure."
              delay={0.2}
            />
            <FeatureCard
              icon={<Smartphone size={40} />}
              title="Telegram Native"
              description="Jump straight into the action directly from your Telegram chats. Seamless integration for maximum accessibility."
              delay={0.4}
            />
            <FeatureCard
              icon={<Zap size={40} />}
              title="High-Octane Action"
              description="Fast-paced rules designed for quick, intense sessions. Experience card gaming at the speed of light."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Game Selection Modal */}
      <Modal
        isOpen={showGameSelect}
        onClose={() => setShowGameSelect(false)}
        title="SELECT PROTOCOL"
      >
        <div className="space-y-4">
          <button
            onClick={handleGameSelect}
            className="w-full btn-primary flex items-center justify-center gap-3 group"
          >
            <Gamepad2 size={24} className="group-hover:animate-bounce" />
            <span>CRAZY CARD GAME</span>
          </button>
          <p className="text-center text-gray-500 text-sm font-mono">
            // MORE_GAMES_LOADING...
          </p>
        </div>
      </Modal>

      {/* Mode Selection Modal */}
      <Modal
        isOpen={showModeSelect}
        onClose={() => setShowModeSelect(false)}
        title="SELECT MODE"
      >
        <div className="space-y-4">
          <button
            onClick={() => handleModeSelect('multi')}
            className="w-full btn-primary flex items-center justify-center gap-3"
          >
            <Users size={24} />
            <span>MULTIPLAYER</span>
          </button>
          <button
            onClick={() => handleModeSelect('single')}
            className="w-full btn-secondary flex items-center justify-center gap-3 opacity-50 cursor-not-allowed"
            disabled
          >
            <Gamepad2 size={24} />
            <span>SINGLE PLAYER (LOCKED)</span>
          </button>
        </div>
      </Modal>

      {/* User Info Modal */}
      <Modal
        isOpen={showUserInfo}
        onClose={() => setShowUserInfo(false)}
        title="IDENTITY VERIFICATION"
      >
        <UserInfoModal
          onSubmit={handleUserInfoSubmit}
          isJoining={joinMode === 'join'}
          isLoading={isLoading}
        />
      </Modal>

      {/* Join Game Modal */}
      <Modal
        isOpen={showJoinGameModal}
        onClose={() => setShowJoinGameModal(false)}
        title="JOIN PROTOCOL"
      >
        <JoinGameModal
          onJoin={handleJoinSubmit}
          onCancel={() => setShowJoinGameModal(false)}
        />
      </Modal>
    </main>
  );
}
