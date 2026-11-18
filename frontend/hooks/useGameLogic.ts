'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useGameStore } from '@/lib/store';
import { restoreSessionFromStorage } from '@/lib/store/storage';
import type { Card, RankedPlayer, Rank, Suit } from '@/types/game.types';

export type SortMode = 'none' | 'suit' | 'rank';

const SUIT_ORDER: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
};

const RANK_ORDER: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

export function useGameLogic() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    socket,
    isConnected,
    isRestoringSession,
    roomId: storeRoomId,
    gameStarted,
    yourCards,
    players,
    activePlayers,
    finishedPlayers,
    gameOver,
    currentTurn,
    currentSuit,
    turnDirection,
    topCard,
    punishmentChain,
    lastPlayerId,
    blunderActive,
    blunderReason,
    blunderPlayerId,
    blunderTimeLeft,
    blunderTotalTime,
    playCard,
    takePunishment,
    callCrazy,
    revertBlunder,
    playAgain,
    leaveGame,
    fetchGameState,
    isCreator,
    username,
    avatar,
    playerId,
    drawCount,
    deckCount,
    pileCount,
    ruleConfig,
    isFinished,
    myRank,
    terminatedMessage,
    clearBlunderTimers,
  } = useGameStore();

  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [showSuitModal, setShowSuitModal] = useState(false);
  const [pendingCards, setPendingCards] = useState<Card[]>([]);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('suit');

  // Redirect home when room is terminated by host
  useEffect(() => {
    if (terminatedMessage) {
      const timeout = setTimeout(() => {
        router.push('/');
      }, 1800);
      return () => clearTimeout(timeout);
    }
  }, [terminatedMessage, router]);

  // Verify session presence and sync authoritative game state on mount/reconnect
  useEffect(() => {
    if (isRestoringSession) return;

    const saved = restoreSessionFromStorage();
    const hasSessionForRoom =
      (storeRoomId === roomId && Boolean(playerId)) || (saved && saved.roomId === roomId);

    if (!hasSessionForRoom) {
      router.replace('/');
      return;
    }

    if (isConnected && playerId && storeRoomId === roomId && !gameStarted && !gameOver) {
      void fetchGameState(roomId);
    }
  }, [
    isConnected,
    isRestoringSession,
    playerId,
    storeRoomId,
    roomId,
    gameStarted,
    gameOver,
    fetchGameState,
    router,
  ]);

  // Clear selection whenever hand changes or turn ends
  useEffect(() => {
    setSelectedCards((prev) => prev.filter((sel) => yourCards.some((c) => c.id === sel.id)));
  }, [yourCards]);

  useEffect(() => {
    return () => {
      clearBlunderTimers();
    };
  }, [clearBlunderTimers]);

  const isYourTurn = Boolean(playerId && currentTurn === playerId && !isFinished && !gameOver);
  const isMyBlunder = Boolean(
    blunderActive && blunderReason !== null && playerId && blunderPlayerId === playerId
  );
  const canCallCrazy = Boolean(
    playerId &&
      blunderPlayerId &&
      blunderPlayerId !== playerId &&
      !isFinished &&
      !gameOver &&
      blunderTimeLeft > 0
  );

  const sortedCards = useMemo(() => {
    if (sortMode === 'none') return yourCards;
    return [...yourCards].sort((a, b) => {
      if (sortMode === 'suit') {
        const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
        if (suitDiff !== 0) return suitDiff;
        return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
      }
      const rankDiff = RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
      if (rankDiff !== 0) return rankDiff;
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    });
  }, [yourCards, sortMode]);

  const isSuitChangeCard = (card: Card): boolean => {
    const configured = ruleConfig?.specialCards?.suitChangeCards;
    if (configured) {
      return configured.some(
        (selector) => selector.rank === card.rank && (!selector.suit || selector.suit === card.suit)
      );
    }
    return card.rank === '8' || card.rank === 'J';
  };

  const handleRevertBlunder = async () => {
    setLoadingAction('revert');
    const result = await revertBlunder();
    if (!result.success) {
      toast.error(result.error || 'Could not revert move');
    }
    setLoadingAction(null);
  };

  const handleCardClick = (card: Card) => {
    if (!isYourTurn || isFinished || loadingAction !== null) return;

    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.filter((c) => c.id !== card.id);
      }
      return [...prev, card];
    });
  };

  const handleClearSelection = () => {
    setSelectedCards([]);
  };

  const handlePlayCards = async () => {
    if (selectedCards.length === 0 || isFinished || loadingAction !== null) return;

    if (
      selectedCards.length === 1 &&
      !punishmentChain?.active &&
      isSuitChangeCard(selectedCards[0])
    ) {
      setPendingCards(selectedCards);
      setShowSuitModal(true);
      return;
    }

    setLoadingAction('play');
    const result = await playCard(selectedCards);
    if (result.success) {
      setSelectedCards([]);
    } else {
      toast.error(result.error || 'Could not play card');
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
      toast.error(result.error || 'Could not play card');
    }
    setLoadingAction(null);
  };

  const handleTakePunishment = async () => {
    if (!isYourTurn || isFinished || loadingAction !== null) return;
    setLoadingAction('punish');
    const result = await takePunishment();
    if (!result.success) {
      toast.error(result.error || 'Could not complete draw action');
    }
    setLoadingAction(null);
  };

  const handleCallCrazy = async () => {
    if (loadingAction !== null) return;
    setLoadingAction('crazy');
    const result = await callCrazy();
    if (!result.success) {
      toast.error(result.error || 'Could not call Crazy');
    }
    setLoadingAction(null);
  };

  const handleLeaveGame = () => {
    setShowAbortModal(true);
  };

  const handleConfirmLeave = async () => {
    setLoadingAction('leave');
    await leaveGame(isCreator);
    setShowAbortModal(false);
    setLoadingAction(null);
    router.push('/');
  };

  const handlePlayAgain = async () => {
    setLoadingAction('playAgain');
    const result = await playAgain();
    if (!result.success) {
      toast.error(result.error || 'Could not start a new match');
    }
    setLoadingAction(null);
  };

  const handleExitGame = async () => {
    await leaveGame(false);
    router.push('/');
  };

  const rankings: RankedPlayer[] = useMemo(() => {
    return [
      ...finishedPlayers.map((p) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        rank: p.rank || 0,
        finishedAt: p.finishedAt,
      })),
      ...activePlayers
        .filter((p) => !finishedPlayers.some((fp) => fp.id === p.id))
        .map((p, index) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          rank: finishedPlayers.length + index + 1,
          finishedAt: p.finishedAt,
        })),
    ].sort((a, b) => a.rank - b.rank);
  }, [finishedPlayers, activePlayers]);

  const blunderPlayerName = useMemo(() => {
    if (!blunderPlayerId) return null;
    const found = [...players, ...finishedPlayers].find((p) => p.id === blunderPlayerId);
    return found?.username || 'A player';
  }, [blunderPlayerId, players, finishedPlayers]);

  const currentTurnPlayer = useMemo(() => {
    if (!currentTurn) return null;
    return activePlayers.find((p) => p.id === currentTurn) || null;
  }, [currentTurn, activePlayers]);

  return {
    roomId,
    socket,
    isConnected,
    isReconnecting: !isConnected || isRestoringSession,
    gameStarted,
    yourCards: sortedCards,
    players,
    activePlayers,
    finishedPlayers,
    gameOver,
    currentTurn,
    currentTurnPlayer,
    currentSuit,
    turnDirection,
    topCard,
    punishmentChain,
    lastPlayerId,
    blunderActive,
    blunderReason,
    blunderPlayerId,
    blunderPlayerName,
    blunderTimeLeft,
    blunderTotalTime,
    isMyBlunder,
    canCallCrazy,
    isCreator,
    username,
    avatar,
    playerId,
    drawCount,
    deckCount,
    pileCount,
    ruleConfig,
    isFinished,
    myRank,
    isYourTurn,
    selectedCards,
    sortMode,
    setSortMode,
    showSuitModal,
    pendingCards,
    showAbortModal,
    showRulesModal,
    loadingAction,
    rankings,
    setShowSuitModal,
    setPendingCards,
    setShowAbortModal,
    setShowRulesModal,
    handleRevertBlunder,
    handleCardClick,
    handleClearSelection,
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
