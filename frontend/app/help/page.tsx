'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CardComponent from '@/components/Card';

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'special-cards', label: 'Special Cards' },
  { id: 'punishments', label: 'Punishment Chains' },
  { id: 'blunders', label: 'Blunders & Crazy' },
  { id: 'presets', label: 'Rule Presets' },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-parlor-bg text-ivory-200">
      {/* Header */}
      <header className="border-b border-parlor-border bg-parlor-bg/95 sticky top-0 z-20">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 h-16">
          <Link href="/" className="btn-ghost px-2.5 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-brass-500/50 bg-parlor-felt text-brass-400 font-display text-sm">
              ♠
            </span>
            <span className="font-display text-lg font-semibold text-ivory-100">Crazy Rules</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* Intro */}
        <header className="space-y-4 border-b border-parlor-border pb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brass-400">
            Official Table Guide
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ivory-50">
            How to Play Crazy
          </h1>
          <p className="text-base sm:text-lg text-ivory-400 max-w-2xl leading-relaxed">
            Crazy is a fast-paced shedding card game for 2 to 8 players. Be the first player to
            empty your hand while dodging stacked penalties and catching illegal plays.
          </p>

          {/* Section Jump Links */}
          <nav aria-label="Rule sections" className="flex flex-wrap gap-2 pt-2">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-parlor-border bg-parlor-surface px-3 py-1.5 text-xs font-medium text-ivory-300 hover:border-brass-500/60 hover:text-ivory-100 transition-colors"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </header>

        {/* 1. Basics */}
        <section id="basics" className="scroll-mt-24 space-y-5">
          <h2 className="font-display text-2xl font-semibold text-ivory-100">
            1. Objective &amp; Turn Flow
          </h2>
          <div className="surface-panel p-6 space-y-4 text-sm sm:text-base leading-relaxed text-ivory-300">
            <p>
              Every player starts with the configured number of cards (default{' '}
              <strong className="text-ivory-100">7 cards</strong>, with the starting player dealt 1
              extra card to open the round).
            </p>
            <ul className="space-y-2.5 list-disc pl-5">
              <li>
                On your turn, play a card matching either the{' '}
                <strong className="text-ivory-100">active suit</strong> or the{' '}
                <strong className="text-ivory-100">rank</strong> of the top discard card.
              </li>
              <li>
                If you cannot (or choose not to) play, click{' '}
                <strong className="text-ivory-100">Draw Card</strong> to take 1 card from the deck.
                Your turn stays active so you may immediately play if you drew a match—or click{' '}
                <strong className="text-ivory-100">Pass Turn</strong> to move on.
              </li>
              <li>
                Players who empty their hand earn their finishing rank (1st, 2nd, 3rd…) while the
                rest of the table continues until only one player remains.
              </li>
            </ul>
          </div>
        </section>

        {/* 2. Special Cards */}
        <section id="special-cards" className="scroll-mt-24 space-y-5">
          <h2 className="font-display text-2xl font-semibold text-ivory-100">
            2. Special Action Cards
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="surface-panel p-5 flex items-start gap-4">
              <div className="shrink-0">
                <CardComponent
                  card={{ id: 'help-5c', rank: '5', suit: 'clubs' }}
                  size="sm"
                  interactive={false}
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-semibold text-ivory-100">5 — Reverse</h3>
                <p className="text-sm text-ivory-400 leading-relaxed">
                  Reverses the direction of play (clockwise ↔ counter-clockwise). In a{' '}
                  <strong className="text-ivory-200">2-player match</strong>, Reverse acts as a
                  Skip, giving you another immediate turn.
                </p>
              </div>
            </article>

            <article className="surface-panel p-5 flex items-start gap-4">
              <div className="shrink-0">
                <CardComponent
                  card={{ id: 'help-7d', rank: '7', suit: 'diamonds' }}
                  size="sm"
                  interactive={false}
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  7 — Skip &amp; Multi-Drop
                </h3>
                <p className="text-sm text-ivory-400 leading-relaxed">
                  Played alone, a 7 skips the next player. Select a 7 alongside any other cards of
                  the <strong className="text-ivory-200">same matching suit</strong> to drop them
                  all in a single turn.
                </p>
              </div>
            </article>

            <article className="surface-panel p-5 flex items-start gap-4 md:col-span-2">
              <div className="flex shrink-0 -space-x-4">
                <CardComponent
                  card={{ id: 'help-js', rank: 'J', suit: 'spades' }}
                  size="sm"
                  interactive={false}
                />
                <CardComponent
                  card={{ id: 'help-8h', rank: '8', suit: 'hearts' }}
                  size="sm"
                  interactive={false}
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Jack &amp; 8 — Wild Suit Change
                </h3>
                <p className="text-sm text-ivory-400 leading-relaxed">
                  Play a Jack or 8 on any non-punishment turn regardless of the current suit or
                  rank, then declare the new active suit.{' '}
                  <strong className="text-ivory-200">Consecutive restriction:</strong> the immediate
                  next player cannot override your suit choice with another wild card; their card
                  falls back to its natural suit instead.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* 3. Punishment Chains */}
        <section id="punishments" className="scroll-mt-24 space-y-5">
          <h2 className="font-display text-2xl font-semibold text-ivory-100">
            3. Punishment Chains
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="surface-panel p-5 flex items-start gap-4 border-crimson-500/35">
              <div className="shrink-0">
                <CardComponent
                  card={{ id: 'help-as', rank: 'A', suit: 'spades' }}
                  size="sm"
                  interactive={false}
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Ace of Spades (+5)
                </h3>
                <p className="text-sm text-ivory-400 leading-relaxed">
                  Starts or increases a punishment chain by{' '}
                  <strong className="text-ivory-200">5 cards</strong>. The next player must counter
                  with the <strong className="text-ivory-200">2 of Spades</strong> or draw the full
                  penalty stack.
                </p>
              </div>
            </article>

            <article className="surface-panel p-5 flex items-start gap-4 border-crimson-500/35">
              <div className="shrink-0">
                <CardComponent
                  card={{ id: 'help-2h', rank: '2', suit: 'hearts' }}
                  size="sm"
                  interactive={false}
                />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-semibold text-ivory-100">
                  Any Rank 2 (+2)
                </h3>
                <p className="text-sm text-ivory-400 leading-relaxed">
                  Starts or stacks a <strong className="text-ivory-200">+2 card</strong> penalty.
                  Respond with a matching-suit 2 (or the Ace of Spades on a 2♠) to keep passing the
                  chain. When you take penalty cards, your turn stays active.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* 4. Blunders & Calling Crazy */}
        <section id="blunders" className="scroll-mt-24 space-y-5">
          <h2 className="font-display text-2xl font-semibold text-ivory-100">
            4. Blunders &amp; Calling &ldquo;Crazy&rdquo;
          </h2>
          <div className="surface-panel p-6 space-y-4 text-sm sm:text-base text-ivory-300 leading-relaxed">
            <p>
              When you play a card that doesn&apos;t match the table rules (wrong suit/rank,
              unanswered punishment chain, or multi-card drop without a 7), the server holds the
              played cards in escrow and opens a live blunder window:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="surface-elevated p-4 space-y-1">
                <p className="font-mono text-xs font-semibold text-brass-400">0–5 SECONDS</p>
                <h3 className="font-semibold text-ivory-100 text-sm">Revert Move</h3>
                <p className="text-xs text-ivory-400">
                  Catch your own mistake and click Revert before an opponent challenges to recover
                  your cards without penalty.
                </p>
              </div>

              <div className="surface-elevated p-4 space-y-1">
                <p className="font-mono text-xs font-semibold text-crimson-400">0–8 SECONDS</p>
                <h3 className="font-semibold text-ivory-100 text-sm">Call Crazy</h3>
                <p className="text-xs text-ivory-400">
                  Any active opponent can click Call Crazy! The blunderer takes back their cards
                  plus draws 2 penalty cards.
                </p>
              </div>

              <div className="surface-elevated p-4 space-y-1">
                <p className="font-mono text-xs font-semibold text-ivory-400">AFTER 8 SECONDS</p>
                <h3 className="font-semibold text-ivory-100 text-sm">Server Timeout</h3>
                <p className="text-xs text-ivory-400">
                  If neither reverted nor challenged, the server automatically applies the penalty,
                  returns the cards, and advances the turn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Rule Presets */}
        <section id="presets" className="scroll-mt-24 space-y-5 pb-12">
          <h2 className="font-display text-2xl font-semibold text-ivory-100">
            5. Lobby Rule Presets
          </h2>
          <div className="surface-panel divide-y divide-parlor-border">
            {[
              ['Standard', 'Default rules: A♠ (+5), 2s (+2), 5 Reverse, 7 Skip/Drop, J & 8 Wild.'],
              ['Beginner', 'Reduced penalties (A♠ +3, 2s +1, blunder +1) for casual tables.'],
              ['Hardcore', 'Increased penalties (A♠ +7, 2s +3, blunder +3) for intense games.'],
              ['Chaos', 'Adds Queens as Reverse, Kings as Skip, and all Aces as Suit Changers.'],
              ['Classic', 'Pure suit and rank shedding without punishments or wildcards.'],
            ].map(([name, desc]) => (
              <div
                key={name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-6 px-6 py-4"
              >
                <span className="font-semibold text-ivory-100 text-sm sm:w-32 shrink-0">
                  {name}
                </span>
                <span className="text-sm text-ivory-400 flex-1">{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
