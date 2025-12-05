'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Settings, Play, Share2, Shield, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import Modal from '@/components/Modal';
import UserInfoModal from '@/components/UserInfoModal';
import PlayerList from '@/components/PlayerList';
import Background from '@/components/Background';
import { useGameStore } from '@/lib/store';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const isJoining = searchParams.get('join') === 'true';

  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(7);
  const [isLoading, setIsLoading] = useState(false);

  const {
    socket,
    connect,
    setUserInfo,
    joinRoom,
    startGame,
    isCreator,
    players,
    username,
    gameStarted,
  } = useGameStore();

  useEffect(() => {
    if (!socket) {
      // Check if there's saved state indicating we should be in this room
      const savedState = sessionStorage.getItem('crazy-game-state');
      if (!savedState) {
        // No saved state, initialize connection
        connect();
      }
      // If there is saved state, the ConnectionManager will handle reconnection
    }
  }, [socket, connect]);

  useEffect(() => {
    // Check if current user is already in the players list (reconnection)
    const isAlreadyInRoom = socket && players.some(p => p.id === socket.id);
    
    // Only show user info modal if socket is connected and user hasn't set their info
    // AND they haven't already joined the room
    if (socket && !username && !isAlreadyInRoom) {
      setShowUserInfo(true);
    } else if (username || isAlreadyInRoom) {
      setShowUserInfo(false);
    }
  }, [socket, username, players]);

  const handleUserInfoSubmit = async (username: string, avatar: string) => {
    setUserInfo(username, avatar);
    setIsLoading(true);
    
    const result = await joinRoom(roomId);
    
    if (result.success) {
      setShowUserInfo(false);
      setIsLoading(false);
    } else {
      alert('Failed to join room: ' + result.error);
      router.push('/');
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const link = `${siteUrl}/room/${roomId}?join=true`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    setIsLoading(true);
    const result = await startGame(cardsPerPlayer);
    
    if (result.success) {
      router.push(`/game/${roomId}`);
    } else {
      alert('Failed to start game: ' + result.error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (gameStarted) {
      router.push(`/game/${roomId}`);
    }
  }, [gameStarted, roomId, router]);

  const roomLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/room/${roomId}?join=true`;

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-8">
      <Background />
      
      <div className="relative z-10 max-w-6xl mx-auto w-full space-y-8">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyber-primary to-white mb-2">
              GAME LOBBY
            </h1>
            <div className="flex items-center gap-2 text-cyber-primary/80 font-mono text-sm">
              <span className="animate-pulse">●</span> SYSTEM STATUS: ONLINE
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Room Access Code</span>
            <div className="flex items-center gap-3 bg-cyber-black/50 p-2 pr-4 rounded-lg border border-cyber-primary/30 w-full md:w-auto justify-between">
              <code className="text-xl md:text-2xl font-mono text-cyber-primary px-4 tracking-widest">
                {roomId}
              </code>
              <button
                onClick={handleCopyLink}
                className="p-2 hover:bg-cyber-primary/20 rounded-md transition-colors text-cyber-primary"
                title="Copy Link"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player List Column */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="glass-panel p-6 h-full min-h-[400px]">
              <PlayerList players={players} currentUserId={socket?.id} />
            </div>
          </motion.div>

          {/* Controls Column */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {/* Invite Card */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Share2 className="text-cyber-secondary" size={20} />
                INVITE PLAYERS
              </h3>
              
              <button
                onClick={() => setShowQR(true)}
                className="w-full btn-secondary flex items-center justify-center gap-2 group"
              >
                <div className="bg-white p-1 rounded-sm">
                  <QRCodeSVG value={roomLink} size={24} />
                </div>
                <span>SHOW QR CODE</span>
              </button>
            </div>

            {/* Game Controls */}
            <div className="glass-panel p-6 space-y-4 border-cyber-primary/30">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Cpu className="text-cyber-primary" size={20} />
                GAME CONTROLS
              </h3>

              {isCreator ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    <Settings size={20} />
                    SETTINGS
                  </button>

                  <button
                    onClick={handleStartGame}
                    disabled={players.length < 2 || isLoading}
                    className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                  >
                    {isLoading ? (
                      <div className="animate-spin h-5 w-5 border-2 border-cyber-primary border-t-transparent rounded-full" />
                    ) : (
                      <Play size={20} fill="currentColor" />
                    )}
                    <span>{isLoading ? 'STARTING...' : 'START GAME'}</span>
                  </button>

                  {players.length < 2 && (
                    <p className="text-xs text-cyber-warning text-center font-mono animate-pulse">
                      [!] WAITING FOR PLAYERS (MIN 2)
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="animate-spin w-8 h-8 border-2 border-cyber-primary border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-sm text-gray-400 font-mono">
                    WAITING FOR HOST TO START...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* User Info Modal */}
      <Modal
        isOpen={showUserInfo}
        onClose={() => {
          // Allow closing if user already has info (reconnecting scenario)
          if (username) {
            setShowUserInfo(false);
          }
        }}
        title="PLAYER IDENTIFICATION"
      >
        <UserInfoModal onSubmit={handleUserInfoSubmit} isJoining isLoading={isLoading} />
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        title="SCAN TO JOIN"
      >
        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            <QRCodeSVG value={roomLink} size={256} />
          </div>
          <p className="text-sm text-cyber-primary font-mono text-center">
            // SCAN_CODE_TO_ESTABLISH_CONNECTION
          </p>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="SYSTEM CONFIGURATION"
      >
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-bold text-cyber-primary mb-4 uppercase tracking-wider">
              Cards per Player: <span className="text-white text-lg ml-2">{cardsPerPlayer}</span>
            </label>
            <input
              type="range"
              min="5"
              max="13"
              value={cardsPerPlayer}
              onChange={(e) => setCardsPerPlayer(Number(e.target.value))}
              className="w-full accent-cyber-primary h-2 bg-cyber-dark rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
              <span>MIN: 5</span>
              <span>MAX: 13</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-cyber-primary mb-4 uppercase tracking-wider">
              Custom Rules
            </label>
            <textarea
              className="w-full px-4 py-3 bg-cyber-black/50 border border-cyber-primary/30 rounded-lg focus:ring-2 focus:ring-cyber-primary focus:border-transparent outline-none text-white placeholder-gray-600 font-mono text-sm"
              rows={3}
              placeholder="// ENTER_CUSTOM_RULES..."
            />
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full btn-primary"
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </Modal>
    </main>
  );
}
