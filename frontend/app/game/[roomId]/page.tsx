'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, Shield, Play, AlertTriangle, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
import CardHand from '@/components/CardHand';
import PlayerList from '@/components/PlayerList';
import Background from '@/components/Background';
import SuitSelectionModal from '@/components/SuitSelectionModal';
import GameOverModal from '@/components/GameOverModal';
import BlunderModal from '@/components/BlunderModal';
import { AbortGameModal } from '@/components/AbortGameModal';
import { useGameStore } from '@/lib/store';
import type { Card, RankedPlayer } from '@/types/game.types';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    socket,
    gameStarted,
    yourCards,
    players,
    activePlayers,
    finishedPlayers,
    gameOver,
    currentTurn,
    currentSuit,
    topCard,
    punishmentChain,
    lastPlayerId,
    blunderActive,
    blunderReason,
    blunderTimeLeft,
    playCard,
    takePunishment,
    callCrazy,
    revertBlunder,
    setGameState,
    isCreator,
    username,
    avatar,
    drawCount,
  } = useGameStore();

  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [showSuitModal, setShowSuitModal] = useState(false);
  const [pendingCards, setPendingCards] = useState<Card[]>([]);
  const [showAbortModal, setShowAbortModal] = useState(false);

  useEffect(() => {
    if (!socket) {
      router.push('/');
    }
  }, [socket, router]);

  const isYourTurn = socket?.id === currentTurn;

  const handleRevertBlunder = async () => {
    const result = await revertBlunder();
    if (!result.success) {
      alert('Failed to revert move: ' + result.error);
    }
  };

  const handleCardClick = (card: Card) => {
    if (isYourTurn) {
      setSelectedCards(prev => {
        const isSelected = prev.some(c => c.id === card.id);
        if (isSelected) {
          return prev.filter(c => c.id !== card.id);
        } else {
          return [...prev, card];
        }
      });
    }
  };

  const handlePlayCards = async () => {
    if (selectedCards.length === 0) return;
    
    // Check if playing a single suit-changing card (8 or J)
    const isSuitChangingCard = selectedCards.length === 1 && 
      (selectedCards[0].rank === '8' || selectedCards[0].rank === 'J');
    
    if (isSuitChangingCard) {
      setPendingCards(selectedCards);
      setShowSuitModal(true);
      return;
    }
    
    const result = await playCard(selectedCards);
    if (result.success) {
      setSelectedCards([]);
    } else {
      alert(result.error);
    }
  };

  const handleSuitSelect = async (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades') => {
    setShowSuitModal(false);
    const result = await playCard(pendingCards, suit);
    if (result.success) {
      setSelectedCards([]);
      setPendingCards([]);
    } else {
      alert(result.error);
    }
  };

  const handleTakePunishment = async () => {
    const result = await takePunishment();
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleCallCrazy = async () => {
    // Get the previous player (the one who just played)
    const targetId = lastPlayerId;
    
    if (!targetId) {
      alert('No previous player to call crazy on');
      return;
    }
    
    const targetPlayer = players.find(p => p.id === targetId);
    const confirmed = confirm(`Call CRAZY on ${targetPlayer?.username || 'previous player'}?`);
    
    if (confirmed) {
      const result = await callCrazy(targetId);
      if (!result.success) {
        alert(result.error);
      }
    }
  };

  const handleLeaveGame = () => {
    setShowAbortModal(true);
  };

  const handleConfirmLeave = () => {
    if (isCreator) {
      // Creator terminates the game - emit leave event
      socket?.emit('leave-game', { roomId, isCreator: true });
    } else {
      // Regular player leaves - emit leave event
      socket?.emit('leave-game', { roomId, isCreator: false, username, avatar });
    }
    
    setShowAbortModal(false);
    router.push('/');
  };

  const handlePlayAgain = () => {
    // Reset game state and redirect to room
    router.push(`/room/${roomId}`);
  };

  // Create rankings for game over modal
  const rankings: RankedPlayer[] = [
    ...finishedPlayers.map(p => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      rank: p.rank || 0,
    })),
    ...activePlayers.map((p, index) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      rank: finishedPlayers.length + index + 1,
    })),
  ].sort((a, b) => a.rank - b.rank);

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
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="text-cyber-secondary" size={20} />
                  ACTIVE BATTLEFIELD
                </h2>
                {currentSuit && (
                  <div className="flex items-center gap-2 text-cyber-primary">
                    <span className="text-sm font-mono">SUIT:</span>
                    <span className="text-2xl">
                      {currentSuit === 'hearts' && '♥'}
                      {currentSuit === 'diamonds' && '♦'}
                      {currentSuit === 'clubs' && '♣'}
                      {currentSuit === 'spades' && '♠'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex items-center justify-center relative z-10">
                <div className="w-full h-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center bg-cyber-black/20 backdrop-blur-sm">
                  {topCard ? (
                    <div className="text-center">
                      <div className="mb-4">
                        <div className="text-6xl font-bold text-white">{topCard.rank}</div>
                        <div className="text-4xl mt-2">
                          {topCard.suit === 'hearts' && <span className="text-cyber-warning">♥</span>}
                          {topCard.suit === 'diamonds' && <span className="text-cyber-warning">♦</span>}
                          {topCard.suit === 'clubs' && <span className="text-cyber-primary">♣</span>}
                          {topCard.suit === 'spades' && <span className="text-cyber-primary">♠</span>}
                        </div>
                      </div>
                      {punishmentChain?.active && (
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1.1 }}
                          transition={{ repeat: Infinity, duration: 0.5, repeatType: 'reverse' }}
                          className="text-cyber-warning font-bold mt-4"
                        >
                          ⚠ PUNISHMENT CHAIN: {punishmentChain.amount} CARDS
                        </motion.div>
                      )}
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            </div>

            {/* Player Hand */}
            <div className="glass-panel p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-cyber-primary">///</span> 
                  YOUR HAND <span className="text-gray-500 text-sm font-mono">({yourCards.length})</span>
                  {selectedCards.length > 0 && (
                    <span className="text-cyber-accent text-sm font-mono animate-pulse">
                      [{selectedCards.length} SELECTED]
                    </span>
                  )}
                </h2>
                
                {isYourTurn && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleTakePunishment}
                      className={`btn-secondary px-4 py-2 text-sm flex items-center gap-2 ${
                        punishmentChain?.active 
                          ? 'border-cyber-warning text-cyber-warning hover:bg-cyber-warning/10' 
                          : drawCount === 1
                          ? 'border-cyber-accent text-cyber-accent hover:bg-cyber-accent/10'
                          : ''
                      }`}
                      title={
                        punishmentChain?.active 
                          ? `Take ${punishmentChain.amount} Punishment Cards` 
                          : drawCount === 1 
                          ? 'Draw again (will pass turn)' 
                          : 'Draw 1 Card (can draw again)'
                      }
                    >
                      <Hand size={16} />
                      <span className="hidden sm:inline">
                        {punishmentChain?.active 
                          ? `TAKE (${punishmentChain.amount})` 
                          : drawCount === 1 
                          ? 'PASS' 
                          : 'DRAW'}
                      </span>
                    </button>
                    <button
                      onClick={handleCallCrazy}
                      className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 border-cyber-warning text-cyber-warning hover:bg-cyber-warning/10"
                      title="Call Crazy"
                    >
                      <AlertTriangle size={16} />
                      <span className="hidden sm:inline">CRAZY</span>
                    </button>
                    <button
                      onClick={handlePlayCards}
                      disabled={selectedCards.length === 0}
                      className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Play Selected Cards"
                    >
                      <Play size={16} />
                      <span className="hidden sm:inline">PLAY</span>
                    </button>
                  </div>
                )}
              </div>
              
              <CardHand
                cards={yourCards}
                selectedCards={selectedCards}
                onCardClick={handleCardClick}
                disabled={!isYourTurn}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="glass-panel p-6 h-fit space-y-4">
            <PlayerList 
              players={activePlayers} 
              currentUserId={socket?.id}
              currentTurn={currentTurn}
            />
            
            {finishedPlayers.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Finished ({finishedPlayers.length})
                </h3>
                <div className="space-y-2">
                  {finishedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{player.avatar}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{player.username}</p>
                          <p className="text-xs text-yellow-500">
                            {player.rank === 1 ? '🏆 Winner' : `${player.rank}${getRankSuffix(player.rank || 0)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suit Selection Modal */}
      <SuitSelectionModal 
        isOpen={showSuitModal}
        onSelect={handleSuitSelect}
      />

      {/* Blunder Modal */}
      <BlunderModal
        isOpen={blunderActive && blunderReason !== null}
        reason={blunderReason || ''}
        timeLeft={blunderTimeLeft}
        onRevert={handleRevertBlunder}
        onClose={() => {}}
      />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameOver}
        rankings={rankings}
        onPlayAgain={handlePlayAgain}
      />

      {/* Abort Game Modal */}
      <AbortGameModal
        isOpen={showAbortModal}
        isCreator={isCreator}
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowAbortModal(false)}
      />
    </main>
  );
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}
