import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import type { Card, RankedPlayer } from '@/types/game.types';

export function useGameLogic() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    socket,
    isConnected,
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
    blunderPlayerId,
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    // Don't redirect immediately - wait for reconnection
    if (!socket) {
      // Check if there's saved state indicating we should be in a game
      const savedState = sessionStorage.getItem('crazy-game-state');
      if (!savedState) {
        // No saved state, redirect to home
        router.push('/');
      } else {
        // Show reconnecting state
        setIsReconnecting(true);
      }
      // If there is saved state, the ConnectionManager will handle reconnection
    } else if (isConnected) {
      setIsReconnecting(false);
    }
  }, [socket, isConnected, router]);

  const isYourTurn = socket?.id === currentTurn;

  const handleRevertBlunder = async () => {
    setLoadingAction('revert');
    const result = await revertBlunder();
    if (!result.success) {
      alert('Failed to revert move: ' + result.error);
    }
    setLoadingAction(null);
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
    
    setLoadingAction('play');
    const result = await playCard(selectedCards);
    if (result.success) {
      setSelectedCards([]);
    } else {
      alert(result.error);
    }
    setLoadingAction(null);
  };

  const handleSuitSelect = async (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades') => {
    setShowSuitModal(false);
    setLoadingAction('play');
    const result = await playCard(pendingCards, suit);
    if (result.success) {
      setSelectedCards([]);
      setPendingCards([]);
    } else {
      alert(result.error);
    }
    setLoadingAction(null);
  };

  const handleTakePunishment = async () => {
    setLoadingAction('punish');
    const result = await takePunishment();
    if (!result.success) {
      alert(result.error);
    }
    setLoadingAction(null);
  };

  const handleCallCrazy = async () => {
    setLoadingAction('crazy');
    const result = await callCrazy();
    if (!result.success) {
      alert(result.error);
    }
    setLoadingAction(null);
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
    setLoadingAction('playAgain');
    // Emit request to start a new game with same players
    socket?.emit('play-again', { roomId }, (response: any) => {
      if (response.success) {
        // Game will start automatically via game-started event
        // Just close the game over modal by resetting game over state
        setGameState({ gameOver: false });
      } else {
        alert('Failed to start new game: ' + response.error);
      }
      setLoadingAction(null);
    });
  };

  const handleExitGame = () => {
    // Clear local storage
    sessionStorage.removeItem('crazy-game-state');
    
    // Disconnect and navigate home
    if (socket) {
      socket.emit('leave-game', { roomId, isCreator, username, avatar });
    }
    
    router.push('/');
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

  return {
    roomId,
    socket,
    isConnected,
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
    blunderPlayerId,
    blunderTimeLeft,
    isCreator,
    username,
    avatar,
    drawCount,
    isYourTurn,
    selectedCards,
    showSuitModal,
    pendingCards,
    showAbortModal,
    isReconnecting,
    loadingAction,
    rankings,
    setShowSuitModal,
    setPendingCards,
    setShowAbortModal,
    handleRevertBlunder,
    handleCardClick,
    handlePlayCards,
    handleSuitSelect,
    handleTakePunishment,
    handleCallCrazy,
    handleLeaveGame,
    handleConfirmLeave,
    handlePlayAgain,
    handleExitGame,
  };
}
