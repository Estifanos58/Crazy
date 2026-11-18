'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Layers,
  Loader2,
  Plus,
  Repeat2,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import UserInfoModal from '@/components/UserInfoModal';
import JoinGameModal from '@/components/JoinGameModal';
import CardComponent from '@/components/Card';
import { useGameStore } from '@/lib/store';
import { clearSessionFromStorage } from '@/lib/store/storage';
import type { Card } from '@/types/game.types';

const SHOWCASE_CARDS: { card: Card; role: string; summary: string }[] = [
  {
    card: { id: 'showcase-5c', rank: '5', suit: 'clubs' },
    role: 'Reverse',
    summary: 'Flips turn order. In a 2-player match, acts as a Skip so you go again.',
  },
  {
    card: { id: 'showcase-7h', rank: '7', suit: 'hearts' },
    role: 'Skip & Multi-Drop',
    summary: 'Skips the next player, or lets you shed multiple cards of the same suit at once.',
  },
  {
    card: { id: 'showcase-as', rank: 'A', suit: 'spades' },
    role: 'Ace of Spades (+5)',
    summary: 'Starts or stacks a 5-card punishment chain. Counter only with the 2 of Spades.',
  },
  {
    card: { id: 'showcase-jd', rank: 'J', suit: 'diamonds' },
    role: 'Wild Suit Change',
    summary: 'Play on any normal turn to declare a new active suit for the table.',
  },
  {
    card: { id: 'showcase-2s', rank: '2', suit: 'spades' },
    role: 'Punishment Stack (+2)',
    summary: 'Forces the next player to draw 2 cards—or stack another matching 2 to raise the stakes.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { isConnected, setUserInfo, createRoom, joinRoom, resetRoomState, username, avatar } =
    useGameStore();

  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | 'profile'>('create');
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeShowcaseIdx, setActiveShowcaseIdx] = useState(2);

  const handleCreateTable = async () => {
    clearSessionFromStorage();
    resetRoomState();

    if (!username.trim()) {
      setPendingAction('create');
      setShowUserInfo(true);
      return;
    }

    setIsLoading(true);
    const result = await createRoom();
    if (result.success && result.roomId) {
      router.push(`/room/${result.roomId}`);
    } else {
      toast.error(result.error || 'Could not create room');
      setIsLoading(false);
    }
  };

  const handleOpenJoin = () => {
    clearSessionFromStorage();
    resetRoomState();
    setShowJoinModal(true);
  };

  const handleJoinCodeSubmit = async (roomId: string) => {
    setTargetRoomId(roomId);
    setShowJoinModal(false);

    if (!username.trim()) {
      setPendingAction('join');
      setShowUserInfo(true);
      return;
    }

    setIsLoading(true);
    const result = await joinRoom(roomId);
    if (result.success) {
      router.push(`/room/${roomId}`);
    } else {
      toast.error(result.error || 'Could not join room');
      setIsLoading(false);
      setPendingAction('join');
      setShowUserInfo(true);
    }
  };

  const handleUserInfoSubmit = async (nextUsername: string, nextAvatar: string) => {
    setUserInfo(nextUsername, nextAvatar);

    if (pendingAction === 'profile') {
      setShowUserInfo(false);
      toast.success('Profile updated');
      return;
    }

    setIsLoading(true);
    if (pendingAction === 'create') {
      const result = await createRoom();
      if (result.success && result.roomId) {
        setShowUserInfo(false);
        router.push(`/room/${result.roomId}`);
      } else {
        toast.error(result.error || 'Could not create room');
        setIsLoading(false);
      }
      return;
    }

    if (pendingAction === 'join' && targetRoomId) {
      const result = await joinRoom(targetRoomId);
      if (result.success) {
        setShowUserInfo(false);
        router.push(`/room/${targetRoomId}`);
      } else {
        toast.error(result.error || 'Could not join room');
        setIsLoading(false);
      }
    }
  };

  const activeShowcase = SHOWCASE_CARDS[activeShowcaseIdx];

  return (
    <div className="min-h-screen flex flex-col bg-parlor-bg text-ivory-200">
      {/* Top Navigation */}
      <header className="border-b border-parlor-border bg-parlor-bg/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-16">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brass-500/50 bg-parlor-felt text-brass-400 font-display text-base">
              ♠
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-ivory-100">
              Crazy
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary navigation">
            <Link href="/help" className="btn-ghost text-sm">
              <BookOpen className="h-4 w-4 text-ivory-400" aria-hidden="true" />
              <span>Rules</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setPendingAction('profile');
                setShowUserInfo(true);
              }}
              className="btn-secondary py-2 px-3.5 text-xs sm:text-sm min-h-[38px]"
            >
              {avatar ? (
                <span className="text-base leading-none" aria-hidden="true">
                  {avatar}
                </span>
              ) : (
                <User className="h-4 w-4 text-ivory-400" aria-hidden="true" />
              )}
              <span className="max-w-[110px] truncate">{username || 'Set Profile'}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Editorial Copy & CTAs */}
            <div className="lg:col-span-6 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-parlor-border bg-parlor-surface px-3.5 py-1.5 text-xs font-medium text-ivory-300">
                <span
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-jade-400' : 'bg-ivory-500'}`}
                  aria-hidden="true"
                />
                <span>Live Multiplayer Table • 2 to 8 Players</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold leading-[1.08] text-ivory-50">
                  Classic card play, sharp table tension.
                </h1>
                <p className="text-base sm:text-lg leading-relaxed text-ivory-400 max-w-xl">
                  Empty your hand before the table catches you slipping. Stack draw penalties,
                  reverse momentum, declare suits, and call <strong className="text-ivory-200 font-semibold">Crazy</strong> when an opponent blunders.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCreateTable}
                  disabled={isLoading}
                  className="btn-primary px-6 py-3.5 text-base"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Create a Table</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenJoin}
                  disabled={isLoading}
                  className="btn-secondary px-6 py-3.5 text-base"
                >
                  <Users className="h-4 w-4 text-ivory-300" aria-hidden="true" />
                  <span>Join with Code</span>
                </button>
              </div>

              <div className="pt-2 flex items-center gap-6 text-sm text-ivory-400">
                <Link
                  href="/help"
                  className="inline-flex items-center gap-1.5 font-medium text-brass-400 hover:text-brass-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 rounded"
                >
                  <span>Learn the rules in 2 minutes</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Tactile Felt Table Card Showcase */}
            <div className="lg:col-span-6">
              <div className="felt-table rounded-3xl border border-parlor-border p-6 sm:p-8">
                <div className="flex items-center justify-between text-xs text-ivory-300/80 mb-6">
                  <span className="uppercase tracking-widest font-medium">Signature Cards</span>
                  <span className="font-mono text-ivory-300/70">Select a card to inspect</span>
                </div>

                {/* Fanned Playing Cards */}
                <div className="flex items-end justify-center py-6 sm:py-8">
                  {SHOWCASE_CARDS.map((item, idx) => {
                    const isSelected = idx === activeShowcaseIdx;
                    const rotationClasses = [
                      '-rotate-6',
                      '-rotate-3',
                      'rotate-0',
                      'rotate-3',
                      'rotate-6',
                    ][idx];
                    return (
                      <div
                        key={item.card.id}
                        className={`-ml-5 sm:-ml-6 first:ml-0 transition-transform duration-150 ${rotationClasses}`}
                      >
                        <CardComponent
                          card={item.card}
                          isSelected={isSelected}
                          onClick={() => setActiveShowcaseIdx(idx)}
                          size="md"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Selected Card Caption */}
                <div className="mt-4 rounded-2xl border border-ivory-200/10 bg-parlor-bg/70 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h2 className="font-display text-lg font-semibold text-ivory-100">
                      {activeShowcase.role}
                    </h2>
                    <span className="rounded-md border border-brass-500/40 bg-brass-500/10 px-2 py-0.5 font-mono text-xs font-medium text-brass-300">
                      {activeShowcase.card.rank}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-ivory-300">{activeShowcase.summary}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Mechanics Overview */}
        <section className="border-t border-parlor-border bg-parlor-surface/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ivory-100">
                Built for real-time table play
              </h2>
              <p className="mt-2 text-sm sm:text-base text-ivory-400">
                Server-authoritative deck handling, instant room invites via code or QR, and
                seamless reconnection if a player drops.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <article className="surface-elevated p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson-500/15 text-crimson-400 border border-crimson-500/25">
                  <Layers className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Stacking Punishments
                </h3>
                <p className="text-sm leading-relaxed text-ivory-400">
                  Drop a 2 for +2 cards or the Ace of Spades for +5. Chain matching counters to pass
                  an escalating penalty around the table.
                </p>
              </article>

              <article className="surface-elevated p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-500/15 text-brass-400 border border-brass-500/25">
                  <Repeat2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Tactical Action Cards
                </h3>
                <p className="text-sm leading-relaxed text-ivory-400">
                  Reverse direction with 5s, skip rivals or drop multi-card suit runs with 7s, and
                  redirect the table with Jacks and 8s.
                </p>
              </article>

              <article className="surface-elevated p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-500/15 text-jade-400 border border-jade-500/25">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Live Blunder Challenges
                </h3>
                <p className="text-sm leading-relaxed text-ivory-400">
                  Illegal plays open a brief window: catch your own mistake and revert in time, or
                  get caught by an opponent calling Crazy.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-parlor-border bg-parlor-bg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ivory-500">
          <p>Crazy Multiplayer Card Game</p>
          <div className="flex items-center gap-5">
            <Link href="/help" className="hover:text-ivory-200 transition-colors">
              Rules &amp; Guide
            </Link>
            <button
              type="button"
              onClick={handleCreateTable}
              className="hover:text-ivory-200 transition-colors"
            >
              Create Table
            </button>
            <button
              type="button"
              onClick={handleOpenJoin}
              className="hover:text-ivory-200 transition-colors"
            >
              Join Table
            </button>
          </div>
        </div>
      </footer>

      {/* Profile / Identity Modal */}
      <Modal
        isOpen={showUserInfo}
        onClose={() => {
          if (!isLoading) setShowUserInfo(false);
        }}
        title={
          pendingAction === 'profile'
            ? 'Player Profile'
            : pendingAction === 'join'
            ? 'Join Table'
            : 'Create a Table'
        }
        description={
          pendingAction === 'profile'
            ? 'Customize how you appear to other players.'
            : 'Choose a display name and avatar before taking your seat.'
        }
      >
        <UserInfoModal
          onSubmit={handleUserInfoSubmit}
          submitLabel={
            pendingAction === 'profile'
              ? 'Save Profile'
              : pendingAction === 'join'
              ? 'Join Table'
              : 'Create Table'
          }
          isJoining={pendingAction === 'join'}
          isLoading={isLoading}
          initialUsername={username}
          initialAvatar={avatar}
        />
      </Modal>

      {/* Join Room Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Join an Existing Table"
        description="Enter a room code shared by the host."
      >
        <JoinGameModal
          onJoin={handleJoinCodeSubmit}
          onCancel={() => setShowJoinModal(false)}
        />
      </Modal>
    </div>
  );
}
