import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import type { Card, RankedPlayer, Suit } from '@/types/game.types';

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
    playerId,
    playerToken,
    drawCount,
    isFinished,
    myRank,
    clearBlunderTimers,
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
      const savedState = sessionStorage.getItem('crazy-game-state');
      if (!savedState) {
        router.push('/');
      } else {
        setIsReconnecting(true);
      }
    } else if (isConnected) {
      setIsReconnecting(false);
    }
  }, [socket, isConnected, router]);

  // Clean up blunder timers on component unmount
  useEffect(() => {
    return () => {
      clearBlunderTimers();
    };
  }, [clearBlunderTimers]);

  const myId = playerId || socket?.id;
  const isYourTurn = Boolean(myId && currentTurn === myId && !isFinished);

  const handleRevertBlunder = async () => {
    setLoadingAction('revert');
    const result = await revertBlunder();
    if (!result.success) {
      alert('Failed to revert move: ' + result.error);
    }
    setLoadingAction(null);
  };

  const handleCardClick = (card: Card) => {
    if (isYourTurn && !isFinished) {
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
    if (selectedCards.length === 0 || isFinished) return;
    
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

  const handleSuitSelect = async (suit: Suit) => {
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
    if (isFinished) return;
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
    socket?.emit('leave-game', {
      roomId,
      isCreator,
      playerId,
      playerToken,
      username,
      avatar,
    });
    
    clearBlunderTimers();
    sessionStorage.removeItem('crazy-game-state');
    setShowAbortModal(false);
    router.push('/');
  };

  const handlePlayAgain = () => {
    setLoadingAction('playAgain');
    socket?.emit(
      'play-again',
      { roomId, playerId, playerToken },
      (response: any) => {
        if (response && response.success) {
          setGameState({ gameOver: false, isFinished: false, myRank: null });
        } else {
          alert('Failed to start new game: ' + (response?.error || 'Unknown error'));
        }
        setLoadingAction(null);
      }
    );
  };

  const handleExitGame = () => {
    clearBlunderTimers();
    sessionStorage.removeItem('crazy-game-state');
    
    if (socket) {
      socket.emit('leave-game', { roomId, isCreator, playerId, playerToken, username, avatar });
    }
    
    router.push('/');
  };

  // Create authoritative rankings for game over modal
  const rankings: RankedPlayer[] = [
    ...finishedPlayers.map(p => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      rank: p.rank || 0,
      finishedAt: p.finishedAt,
    })),
    ...activePlayers
      .filter(p => !finishedPlayers.some(fp => fp.id === p.id))
      .map((p, index) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        rank: finishedPlayers.length + index + 1,
        finishedAt: p.finishedAt,
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
    playerId,
    drawCount,
    isFinished,
    myRank,
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
