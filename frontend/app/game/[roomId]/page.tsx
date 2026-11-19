'use client';

import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  Hand,
  Loader2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Trophy,
  X,
} from 'lucide-react';
import CardComponent, { CardBack, SUIT_NAMES, SUIT_SYMBOLS } from '@/components/Card';
import CardHand from '@/components/CardHand';
import SuitSelectionModal from '@/components/SuitSelectionModal';
import GameOverModal from '@/components/GameOverModal';
import BlunderModal from '@/components/BlunderModal';
import { AbortGameModal } from '@/components/AbortGameModal';
import { QuickRulesModal } from '@/components/QuickRulesModal';
import { useGameLogic } from '@/hooks/useGameLogic';
import type { SortMode } from '@/hooks/useGameLogic';

function formatRoomCode(code: string): string {
  if (code.length === 6 && /^[a-zA-Z0-9]+$/.test(code)) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  return code;
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

export default function GamePage() {
  const {
    roomId,
    isReconnecting,
    isYourTurn,
    handleLeaveGame,
    currentTurn,
    currentTurnPlayer,
    currentSuit,
    turnDirection,
    topCard,
    punishmentChain,
    yourCards,
    selectedCards,
    sortMode,
    setSortMode,
    handleTakePunishment,
    loadingAction,
    drawCount,
    deckCount,
    pileCount,
    handleCallCrazy,
    handlePlayCards,
    handleCardClick,
    handleClearSelection,
    activePlayers,
    finishedPlayers,
    playerId,
    isFinished,
    myRank,
    showSuitModal,
    handleSuitSelect,
    setShowSuitModal,
    setPendingCards,
    isMyBlunder,
    canCallCrazy,
    blunderReason,
    blunderPlayerName,
    blunderTimeLeft,
    blunderTotalTime,
    handleRevertBlunder,
    gameOver,
    rankings,
    handlePlayAgain,
    handleExitGame,
    showAbortModal,
    showRulesModal,
    isCreator,
    handleConfirmLeave,
    setShowAbortModal,
    setShowRulesModal,
  } = useGameLogic();

  const opponents = activePlayers.filter((p) => p.id !== playerId);
  const finishedOpponents = finishedPlayers.filter((p) => p.id !== playerId);

  const cycleSortMode = () => {
    const order: SortMode[] = ['suit', 'rank', 'none'];
    const next = order[(order.indexOf(sortMode) + 1) % order.length];
    setSortMode(next);
  };

  const drawActionLabel = punishmentChain?.active
    ? `Take +${punishmentChain.amount}`
    : drawCount >= 1
    ? 'Pass Turn'
    : 'Draw Card';

  const isRedSuit = currentSuit === 'hearts' || currentSuit === 'diamonds';

  return (
    <div className="min-h-screen flex flex-col bg-parlor-bg text-ivory-200">
      {/* Reconnecting Overlay */}
      {isReconnecting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
        >
          <div className="surface-panel max-w-xs w-full p-7 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-brass-400 mx-auto" aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold text-ivory-100">Reconnecting…</h2>
            <p className="text-sm text-ivory-400">
              Restoring your seat and synchronizing the deck.
            </p>
          </div>
        </div>
      )}

      {/* Top Table Header */}
      <header className="border-b border-parlor-border bg-parlor-bg/95 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 h-14">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLeaveGame}
              className="btn-ghost px-2.5 py-1.5 text-xs sm:text-sm min-h-[36px]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{isCreator ? 'End Match' : 'Leave'}</span>
            </button>

            <div className="h-4 w-px bg-parlor-border" />

            <span className="font-mono text-xs sm:text-sm font-semibold text-ivory-200 bg-parlor-surface border border-parlor-border px-2.5 py-1 rounded-lg">
              {formatRoomCode(roomId)}
            </span>
          </div>

          {/* Center Turn Direction Pill */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-parlor-border bg-parlor-surface px-3.5 py-1 text-xs font-medium text-ivory-300">
            {turnDirection === 'clockwise' ? (
              <RotateCw className="h-3.5 w-3.5 text-brass-400" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 text-brass-400" aria-hidden="true" />
            )}
            <span>{turnDirection === 'clockwise' ? 'Clockwise' : 'Counter-clockwise'}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="btn-ghost px-2.5 py-1.5 text-xs sm:text-sm min-h-[36px]"
          >
            <BookOpen className="h-4 w-4 text-ivory-400" aria-hidden="true" />
            <span className="hidden sm:inline">Rules</span>
          </button>
        </div>
      </header>

      {/* Main Card Table Workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 flex flex-col justify-between px-3 sm:px-6 py-4 sm:py-5 gap-4">
        {/* Opponents Seating Strip */}
        <section aria-label="Opponents" className="w-full">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {opponents.map((player) => {
              const isActiveTurn = currentTurn === player.id;
              const isOnline = player.connected !== false;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 min-w-[175px] sm:min-w-[200px] shrink-0 transition-colors ${
                    isActiveTurn
                      ? 'border-brass-500 bg-brass-500/12'
                      : 'border-parlor-border bg-parlor-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-parlor-border bg-parlor-elevated text-lg">
                      <span aria-hidden="true">{player.avatar}</span>
                      <span
                        title={isOnline ? 'Connected' : 'Offline'}
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-parlor-surface ${
                          isOnline ? 'bg-jade-400' : 'bg-ivory-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ivory-100">
                        {player.username}
                      </p>
                      <p className="text-[11px] text-ivory-400">
                        {isActiveTurn ? (
                          <span className="font-semibold text-brass-300">Playing turn</span>
                        ) : !isOnline ? (
                          'Reconnecting…'
                        ) : (
                          'Waiting'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Miniature card count stack */}
                  <div
                    className="flex items-center gap-1 rounded-lg border border-parlor-border bg-parlor-bg px-2 py-1 font-mono text-xs font-semibold text-ivory-100 shrink-0"
                    title={`${player.cardCount} cards in hand`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-3.5 w-2.5 rounded-[2px] border border-brass-500/60 card-back-pattern"
                    />
                    <span>{player.cardCount}</span>
                  </div>
                </div>
              );
            })}

            {finishedOpponents.map((player) => (
              <div
                key={`fin-${player.id}`}
                className="flex items-center gap-2.5 rounded-xl border border-parlor-border bg-parlor-surface/60 px-3.5 py-2.5 min-w-[160px] shrink-0"
              >
                <span className="text-lg" aria-hidden="true">
                  {player.avatar}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ivory-300">{player.username}</p>
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium text-brass-400">
                    <Trophy className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {player.rank}
                      {getRankSuffix(player.rank)} place
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Opponent Blunder Challenge Banner */}
        {canCallCrazy && (
          <section
            role="alert"
            className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-crimson-500/60 bg-crimson-500/15 px-4 sm:px-5 py-3.5"
          >
            <div className="flex items-center gap-3 text-center sm:text-left">
              <AlertTriangle className="h-5 w-5 text-crimson-400 shrink-0" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-ivory-50">
                  {blunderPlayerName} made an illegal play!
                </p>
                <p className="text-xs text-ivory-300">
                  Call Crazy within{' '}
                  <span className="font-mono font-semibold text-ivory-100">
                    {blunderTimeLeft}s
                  </span>{' '}
                  to penalize them before they revert.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCallCrazy}
              disabled={loadingAction !== null}
              className="btn-danger px-5 py-2.5 text-sm shrink-0 w-full sm:w-auto"
            >
              {loadingAction === 'crazy' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Call Crazy!</span>
            </button>
          </section>
        )}

        {/* Center Baize Felt Card Table */}
        <section
          aria-label="Game table"
          className="felt-table relative flex-1 min-h-[270px] sm:min-h-[320px] rounded-3xl border border-parlor-border p-4 sm:p-6 flex flex-col justify-between"
        >
          {/* Table Top Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Turn Indicator */}
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold ${
                isYourTurn
                  ? 'border-brass-400 bg-brass-500 text-parlor-bg'
                  : 'border-ivory-200/15 bg-parlor-bg/65 text-ivory-200'
              }`}
            >
              <span>
                {gameOver
                  ? 'Match Finished'
                  : isYourTurn
                  ? drawCount >= 1
                    ? 'Your Turn — Play or Pass'
                    : 'Your Turn'
                  : currentTurnPlayer
                  ? `${currentTurnPlayer.username}'s Turn`
                  : 'Waiting…'}
              </span>
            </div>

            {/* Active Suit Indicator */}
            {currentSuit && (
              <div className="inline-flex items-center gap-2 rounded-full border border-ivory-200/15 bg-parlor-bg/75 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-ivory-100">
                <span className="text-ivory-400">Active Suit</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md bg-ivory-100 px-2 py-0.5 text-xs font-bold ${
                    isRedSuit ? 'text-crimson-600' : 'text-[#181C1A]'
                  }`}
                >
                  <span aria-hidden="true">{SUIT_SYMBOLS[currentSuit]}</span>
                  <span>{SUIT_NAMES[currentSuit]}</span>
                </span>
              </div>
            )}
          </div>

          {/* Center Draw Deck & Discard Pile */}
          <div className="my-5 flex items-center justify-center gap-8 sm:gap-14">
            {/* Draw Deck */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {/* Stack depth layer */}
                {deckCount > 2 && (
                  <div
                    aria-hidden="true"
                    className="absolute top-1 left-1 w-24 h-[8.5rem] sm:w-28 sm:h-40 rounded-xl border border-brass-500/25 bg-parlor-feltDark"
                  />
                )}
                <CardBack
                  size="lg"
                  count={deckCount}
                  label={
                    isYourTurn
                      ? punishmentChain?.active
                        ? `Take ${punishmentChain.amount} penalty cards`
                        : drawCount >= 1
                        ? 'Pass turn'
                        : 'Draw a card from deck'
                      : `Draw deck (${deckCount} cards)`
                  }
                  onClick={isYourTurn ? handleTakePunishment : undefined}
                  disabled={!isYourTurn || loadingAction !== null}
                />
              </div>
              <span className="text-xs font-medium text-ivory-300/80">
                {isYourTurn && !punishmentChain?.active && drawCount === 0
                  ? 'Tap to Draw'
                  : 'Draw Deck'}
              </span>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-3">
              {topCard ? (
                <div className="relative">
                  {pileCount > 1 && (
                    <div
                      aria-hidden="true"
                      className="absolute -top-1 -left-1.5 w-24 h-[8.5rem] sm:w-28 sm:h-40 rounded-xl border border-ivory-300/40 bg-ivory-200/85 -rotate-3"
                    />
                  )}
                  <CardComponent card={topCard} size="lg" interactive={false} />
                </div>
              ) : (
                <div className="w-24 h-[8.5rem] sm:w-28 sm:h-40 rounded-xl border-2 border-dashed border-ivory-200/25 bg-parlor-bg/25 flex flex-col items-center justify-center p-3 text-center">
                  <span className="font-display text-2xl text-ivory-200/40" aria-hidden="true">
                    ♠
                  </span>
                  <span className="mt-2 text-[11px] font-medium text-ivory-300/75 leading-snug">
                    {isYourTurn ? 'Play any card to open' : 'Opening card'}
                  </span>
                </div>
              )}
              <span className="text-xs font-medium text-ivory-300/80">
                Discard Pile {pileCount > 0 ? `(${pileCount})` : ''}
              </span>
            </div>
          </div>

          {/* Punishment Chain Banner (Inside Table Footer) */}
          <div className="min-h-[32px] flex items-center justify-center">
            {punishmentChain?.active ? (
              <div
                role="status"
                className="inline-flex items-center gap-2 rounded-xl border border-crimson-400/50 bg-crimson-600/25 px-4 py-2 text-xs sm:text-sm font-semibold text-ivory-50"
              >
                <AlertTriangle className="h-4 w-4 text-crimson-400 shrink-0" aria-hidden="true" />
                <span>
                  Punishment Chain: +{punishmentChain.amount} cards — Counter with a matching card
                  or take the penalty.
                </span>
              </div>
            ) : (
              <p className="text-xs text-ivory-300/65 text-center">
                {isYourTurn
                  ? selectedCards.length > 0
                    ? `${selectedCards.length} ${selectedCards.length === 1 ? 'card' : 'cards'} selected — click Play to confirm.`
                    : 'Select one card (or multiple same-suit cards with a 7) to play.'
                  : 'Cards stay ready in your hand until your turn.'}
              </p>
            )}
          </div>
        </section>

        {/* Bottom Player Hand & Controls Dock */}
        <section aria-label="Your hand and actions" className="surface-panel p-4 sm:p-5">
          {isFinished && !gameOver ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 px-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brass-500/50 bg-brass-500/15 text-brass-400">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ivory-100">
                    You finished in {myRank}
                    {getRankSuffix(myRank || 1)} place!
                  </h2>
                  <p className="text-sm text-ivory-400">
                    Spectating while the remaining players complete the round.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Hand Header & Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-ivory-300">
                    Your Hand
                  </h2>
                  <span className="rounded-md border border-parlor-border bg-parlor-bg px-2 py-0.5 font-mono text-xs font-semibold text-ivory-200">
                    {yourCards.length}
                  </span>

                  <button
                    type="button"
                    onClick={cycleSortMode}
                    className="btn-ghost px-2.5 py-1 text-xs min-h-[32px]"
                    title="Change hand sorting"
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Sort: {sortMode === 'suit' ? 'Suit' : sortMode === 'rank' ? 'Rank' : 'Dealt'}
                    </span>
                  </button>

                  {selectedCards.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ivory-400 hover:text-ivory-100 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Clear ({selectedCards.length})</span>
                    </button>
                  )}
                </div>

                {/* Turn Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTakePunishment}
                    disabled={!isYourTurn || loadingAction !== null}
                    className={`flex-1 sm:flex-none px-4 py-2.5 text-sm ${
                      punishmentChain?.active ? 'btn-danger' : 'btn-secondary'
                    }`}
                  >
                    {loadingAction === 'punish' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : drawCount >= 1 && !punishmentChain?.active ? (
                      <SkipForward className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Hand className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{drawActionLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayCards}
                    disabled={!isYourTurn || selectedCards.length === 0 || loadingAction !== null}
                    className="flex-1 sm:flex-none btn-primary px-5 py-2.5 text-sm"
                  >
                    {loadingAction === 'play' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    )}
                    <span>
                      {selectedCards.length > 1 ? `Play ${selectedCards.length} Cards` : 'Play Card'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Playing Cards Hand */}
              <CardHand
                cards={yourCards}
                selectedCards={selectedCards}
                onCardClick={handleCardClick}
                disabled={!isYourTurn || loadingAction !== null}
              />
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      <SuitSelectionModal
        isOpen={showSuitModal}
        onSelect={handleSuitSelect}
        onClose={() => {
          setShowSuitModal(false);
          setPendingCards([]);
        }}
      />

      <BlunderModal
        isOpen={isMyBlunder}
        reason={blunderReason || ''}
        timeLeft={blunderTimeLeft}
        totalTime={blunderTotalTime}
        onRevert={handleRevertBlunder}
        isLoading={loadingAction === 'revert'}
      />

      <GameOverModal
        isOpen={gameOver}
        rankings={rankings}
        isCreator={isCreator}
        currentPlayerId={playerId}
        onPlayAgain={handlePlayAgain}
        onExit={handleExitGame}
        isLoading={loadingAction === 'playAgain'}
      />

      <AbortGameModal
        isOpen={showAbortModal}
        isCreator={isCreator}
        isLoading={loadingAction === 'leave'}
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowAbortModal(false)}
      />

      <QuickRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </div>
  );
}
