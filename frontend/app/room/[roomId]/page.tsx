'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Check,
  Copy,
  Expand,
  Link2,
  Loader2,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import UserInfoModal from '@/components/UserInfoModal';
import PlayerList from '@/components/PlayerList';
import { useGameStore } from '@/lib/store';
import { restoreSessionFromStorage } from '@/lib/store/storage';
import type { RulePresetName } from '@/types/game.types';

const RULE_PRESETS: { id: RulePresetName; label: string; description: string }[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Classic Crazy rules: A♠ (+5), 2s (+2), 5 Reverse, 7 Skip/Drop, J & 8 Wild.',
  },
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Lighter penalties (A♠ +3, 2s +1) and a more forgiving blunder window.',
  },
  {
    id: 'hardcore',
    label: 'Hardcore',
    description: 'Steeper penalties (A♠ +7, 2s +3, blunder +3) for high-stakes matches.',
  },
  {
    id: 'chaos',
    label: 'Chaos',
    description: 'Extra action cards: Queens reverse, Kings skip, and all Aces change suit.',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Pure suit and rank matching with no punishment chains or wild suit changes.',
  },
];

function formatRoomCode(code: string): string {
  if (code.length === 6 && /^[a-zA-Z0-9]+$/.test(code)) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  return code;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    isConnected,
    isRestoringSession,
    roomId: storeRoomId,
    playerId,
    setUserInfo,
    joinRoom,
    startGame,
    leaveGame,
    isCreator,
    creatorId,
    players,
    username,
    avatar,
    gameStarted,
    terminatedMessage,
  } = useGameStore();

  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showQRExpanded, setShowQRExpanded] = useState(false);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(7);
  const [rulePreset, setRulePreset] = useState<RulePresetName>('standard');
  const [customRules, setCustomRules] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState(
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  );

  // Prevent repeated joinRoom calls across re-renders
  const autoJoinAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SITE_URL && typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  // Redirect home if host terminates room while in lobby
  useEffect(() => {
    if (terminatedMessage) {
      const timeout = setTimeout(() => router.push('/'), 1600);
      return () => clearTimeout(timeout);
    }
  }, [terminatedMessage, router]);

  // Navigate to gameplay as soon as match starts
  useEffect(() => {
    if (gameStarted && storeRoomId === roomId) {
      router.push(`/game/${roomId}`);
    }
  }, [gameStarted, storeRoomId, roomId, router]);

  const isSeatedInThisRoom = Boolean(
    playerId && storeRoomId === roomId && players.some((p) => p.id === playerId)
  );
  const isHost = Boolean(isCreator || (playerId && creatorId === playerId));

  // Ensure new visitors join once (never repeatedly!) after connection & session restoration finish
  useEffect(() => {
    if (!isConnected || isRestoringSession) return;
    if (isSeatedInThisRoom) {
      setShowUserInfo(false);
      return;
    }

    // If sessionStorage holds credentials for this room, let ConnectionManager restore it first
    const saved = restoreSessionFromStorage();
    if (saved && saved.roomId === roomId && storeRoomId !== roomId) {
      return;
    }

    if (autoJoinAttemptedRef.current === roomId) {
      return;
    }

    if (username.trim()) {
      autoJoinAttemptedRef.current = roomId;
      setIsJoiningRoom(true);
      void joinRoom(roomId).then((result) => {
        setIsJoiningRoom(false);
        if (!result.success) {
          toast.error(result.error || 'Could not join room');
          setShowUserInfo(true);
        }
      });
    } else {
      autoJoinAttemptedRef.current = roomId;
      setShowUserInfo(true);
    }
  }, [
    isConnected,
    isRestoringSession,
    isSeatedInThisRoom,
    roomId,
    storeRoomId,
    username,
    joinRoom,
  ]);

  // Dynamically cap max cards per player so deck never overflows 52 cards
  const maxCardsAllowed = useMemo(() => {
    const count = Math.max(2, players.length);
    return Math.min(13, Math.floor(51 / count));
  }, [players.length]);

  useEffect(() => {
    if (cardsPerPlayer > maxCardsAllowed) {
      setCardsPerPlayer(maxCardsAllowed);
    }
  }, [cardsPerPlayer, maxCardsAllowed]);

  const roomLink = `${siteOrigin}/room/${roomId}?join=true`;

  const handleUserInfoSubmit = async (nextUsername: string, nextAvatar: string) => {
    setUserInfo(nextUsername, nextAvatar);
    setIsJoiningRoom(true);
    const result = await joinRoom(roomId);
    setIsJoiningRoom(false);

    if (result.success) {
      setShowUserInfo(false);
    } else {
      toast.error(result.error || 'Failed to join room');
    }
  };

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code' ? roomId : roomLink;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success(type === 'code' ? 'Room code copied' : 'Invite link copied');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error('Unable to access clipboard');
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    const result = await startGame(cardsPerPlayer, {
      rulePreset,
      customRules: customRules.trim() || undefined,
    });
    if (!result.success) {
      toast.error(result.error || 'Could not start match');
      setIsStarting(false);
    }
  };

  const handleLeaveLobby = async () => {
    await leaveGame(isHost);
    router.push('/');
  };

  const selectedPresetMeta = RULE_PRESETS.find((p) => p.id === rulePreset) || RULE_PRESETS[0];

  return (
    <div className="min-h-screen flex flex-col bg-parlor-bg text-ivory-200">
      {/* Top Bar */}
      <header className="border-b border-parlor-border bg-parlor-bg/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleLeaveLobby} className="btn-ghost px-2.5">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{isHost ? 'Close Room' : 'Leave Lobby'}</span>
            </button>
            <div className="h-5 w-px bg-parlor-border hidden sm:block" />
            <div>
              <h1 className="font-display text-lg font-semibold text-ivory-100 leading-tight">
                Table Lobby
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-parlor-border bg-parlor-surface px-3 py-1 text-xs text-ivory-300">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-jade-400' : 'bg-crimson-400'}`}
                aria-hidden="true"
              />
              <span>{isConnected ? 'Connected' : 'Reconnecting'}</span>
            </div>

            <Link href="/help" className="btn-ghost text-xs sm:text-sm hidden sm:inline-flex">
              Rules
            </Link>
          </div>
        </div>
      </header>

      {/* Main Lobby Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Seated Players + Match Settings */}
          <div className="lg:col-span-7 space-y-6">
            <section className="surface-panel p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-parlor-border">
                <div>
                  <p className="text-xs uppercase tracking-widest text-ivory-400">Room Code</p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-ivory-50">
                    {formatRoomCode(roomId)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy('code')}
                    className="btn-secondary py-2 px-3.5 text-xs min-h-[38px]"
                  >
                    {copiedType === 'code' ? (
                      <Check className="h-3.5 w-3.5 text-jade-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Copy Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy('link')}
                    className="btn-secondary py-2 px-3.5 text-xs min-h-[38px]"
                  >
                    {copiedType === 'link' ? (
                      <Check className="h-3.5 w-3.5 text-jade-400" aria-hidden="true" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>

              {isJoiningRoom || isRestoringSession ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-ivory-400">
                  <Loader2 className="h-6 w-6 animate-spin text-brass-400" aria-hidden="true" />
                  <span>Taking your seat at the table…</span>
                </div>
              ) : (
                <PlayerList
                  players={players}
                  currentUserId={playerId || undefined}
                  showEmptySeats
                  minSeats={2}
                />
              )}
            </section>

            {/* Match Settings (Host Editable) */}
            <section className="surface-panel p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-brass-400" aria-hidden="true" />
                  <h2 className="font-display text-xl font-semibold text-ivory-100">
                    Match Settings
                  </h2>
                </div>
                {!isHost && (
                  <span className="text-xs text-ivory-400">Configured by the host</span>
                )}
              </div>

              {isHost ? (
                <div className="space-y-6">
                  {/* Cards per Player */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="cards-per-player"
                        className="text-sm font-medium text-ivory-200"
                      >
                        Starting Hand Size
                      </label>
                      <span className="font-mono text-sm font-semibold text-brass-300">
                        {cardsPerPlayer} cards
                      </span>
                    </div>
                    <input
                      id="cards-per-player"
                      type="range"
                      min={5}
                      max={maxCardsAllowed}
                      value={cardsPerPlayer}
                      onChange={(e) => setCardsPerPlayer(Number(e.target.value))}
                      className="w-full accent-brass-500 h-2 bg-parlor-bg rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-xs font-mono text-ivory-500 mt-1.5">
                      <span>5</span>
                      <span>Max {maxCardsAllowed}</span>
                    </div>
                  </div>

                  {/* Rule Presets */}
                  <div>
                    <span className="block text-sm font-medium text-ivory-200 mb-2.5">
                      Rule Preset
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {RULE_PRESETS.map((preset) => {
                        const active = rulePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setRulePreset(preset.id)}
                            aria-pressed={active}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 ${
                              active
                                ? 'border-brass-500 bg-brass-500/15 text-brass-300'
                                : 'border-parlor-border bg-parlor-bg text-ivory-300 hover:bg-parlor-elevated'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-ivory-400">
                      {selectedPresetMeta.description}
                    </p>
                  </div>

                  {/* Optional Table Notes */}
                  <div>
                    <label
                      htmlFor="custom-table-notes"
                      className="block text-sm font-medium text-ivory-200 mb-2"
                    >
                      Table Notes <span className="text-ivory-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="custom-table-notes"
                      rows={2}
                      maxLength={300}
                      value={customRules}
                      onChange={(e) => setCustomRules(e.target.value)}
                      placeholder="Add any house reminders for players…"
                      className="input-field resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-parlor-border bg-parlor-bg/50 p-5 text-sm text-ivory-400">
                  The host is setting up the deck and rule preset. You&apos;ll move to the card
                  table automatically when the match starts.
                </div>
              )}
            </section>
          </div>

          {/* Right Column: QR Invite + Start Action */}
          <div className="lg:col-span-5 space-y-6">
            {/* Start / Waiting Card */}
            <section className="surface-panel p-6 sm:p-7 space-y-4">
              {isHost ? (
                <>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ivory-100">
                      Ready to Deal
                    </h2>
                    <p className="mt-1 text-sm text-ivory-400">
                      {players.length < 2
                        ? 'Invite at least one more player to begin.'
                        : `${players.length} players seated. Deal ${cardsPerPlayer} cards each under ${selectedPresetMeta.label} rules.`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={players.length < 2 || isStarting || !isSeatedInThisRoom}
                    className="w-full btn-primary py-3.5 text-base"
                  >
                    {isStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    )}
                    <span>{isStarting ? 'Dealing Cards…' : 'Start Match'}</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3.5 py-2">
                  <Loader2
                    className="h-5 w-5 animate-spin text-brass-400 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ivory-100">
                      Waiting for Host
                    </h2>
                    <p className="text-sm text-ivory-400">
                      The match will start as soon as the host deals the cards.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* QR Code Share Card */}
            <section className="surface-panel p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ivory-100">
                    Scan to Join
                  </h2>
                  <p className="text-xs text-ivory-400 mt-0.5">
                    Point a phone camera at this code to open the table directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQRExpanded(true)}
                  aria-label="Enlarge QR code"
                  className="btn-ghost p-2 min-h-[36px]"
                >
                  <Expand className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-center">
                <div className="rounded-2xl bg-ivory-50 p-4 border border-ivory-300 shadow-card">
                  <QRCodeSVG
                    value={roomLink}
                    size={176}
                    bgColor="#FDFBF7"
                    fgColor="#141B18"
                    level="M"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-parlor-border bg-parlor-bg/60 px-3.5 py-2.5">
                <p className="truncate font-mono text-xs text-ivory-400">{roomLink}</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Join Identity Modal */}
      <Modal
        isOpen={showUserInfo}
        onClose={() => {
          if (isSeatedInThisRoom) {
            setShowUserInfo(false);
          }
        }}
        dismissible={isSeatedInThisRoom}
        title="Take a Seat"
        description={`Join room ${formatRoomCode(roomId)} with your display name and avatar.`}
      >
        <UserInfoModal
          onSubmit={handleUserInfoSubmit}
          submitLabel="Join Table"
          isJoining
          isLoading={isJoiningRoom}
          initialUsername={username}
          initialAvatar={avatar}
        />
      </Modal>

      {/* Expanded QR Modal */}
      <Modal
        isOpen={showQRExpanded}
        onClose={() => setShowQRExpanded(false)}
        title={`Room ${formatRoomCode(roomId)}`}
        description="Scan with any phone camera to join this table."
        maxWidthClass="max-w-sm"
      >
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="rounded-2xl bg-ivory-50 p-5 border border-ivory-300">
            <QRCodeSVG
              value={roomLink}
              size={240}
              bgColor="#FDFBF7"
              fgColor="#141B18"
              level="M"
            />
          </div>
          <button
            type="button"
            onClick={() => handleCopy('link')}
            className="w-full btn-secondary"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            <span>Copy Invite Link</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
