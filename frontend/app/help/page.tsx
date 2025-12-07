'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, AlertTriangle, Zap, RotateCcw, Ban } from 'lucide-react';
import Link from 'next/link';
import Background from '@/components/Background';

export default function HelpPage() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5 }
        }
    };

    return (
        <main className="min-h-screen relative overflow-y-auto bg-black text-white selection:bg-cyber-primary selection:text-black">
            <Background />

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-cyber-primary hover:text-white transition-colors group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="font-mono text-sm tracking-wider">RETURN_TO_BASE</span>
                    </Link>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-12 pb-20"
                >
                    <motion.header variants={itemVariants} className="space-y-4 border-b border-white/10 pb-8">
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyber-primary via-white to-cyber-primary animate-pulse-glow">
                            COMBAT MANUAL
                        </h1>
                        <p className="text-xl text-gray-400 font-light border-l-2 border-cyber-primary pl-4">
                            Master the protocols. Dominate the game.
                        </p>
                    </motion.header>

                    {/* Section 1: The Basics */}
                    <motion.section variants={itemVariants} className="space-y-6">
                        <div className="flex items-center gap-3 text-2xl font-bold text-white">
                            <Zap className="text-cyber-primary" />
                            <h2>Core Objective</h2>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-lg ml-2">
                            <p className="text-gray-300 leading-relaxed">
                                Be the first to empty your hand. Match the current card's <strong>Suit</strong> or <strong>Rank</strong> to play.
                                Fail to play or make a mistake, and you will be penalized.
                            </p>
                        </div>
                    </motion.section>

                    {/* Section 2: Special Actions */}
                    <motion.section variants={itemVariants} className="space-y-6">
                        <div className="flex items-center gap-3 text-2xl font-bold text-white">
                            <RotateCcw className="text-cyber-secondary" />
                            <h2>Special Function Cards</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 ml-2">
                            <div className="bg-white/5 border-l-4 border-cyber-secondary p-5 rounded-r-lg">
                                <h3 className="font-bold text-cyber-secondary mb-2 flex items-center gap-2">
                                    <RotateCcw size={18} /> Reverse
                                </h3>
                                <p className="text-sm text-gray-400">Reverses the direction of play. The previous player takes the turn.</p>
                            </div>
                            <div className="bg-white/5 border-l-4 border-pink-500 p-5 rounded-r-lg">
                                <h3 className="font-bold text-pink-500 mb-2 flex items-center gap-2">
                                    <Ban size={18} /> Skip
                                </h3>
                                <p className="text-sm text-gray-400">Skips the next player. The turn passes to the player after them.</p>
                            </div>
                            <div className="bg-white/5 border-l-4 border-yellow-400 p-5 rounded-r-lg md:col-span-2">
                                <h3 className="font-bold text-yellow-400 mb-2">Change Suit</h3>
                                <p className="text-sm text-gray-400">
                                    Certain cards allow you to change the current suit. If you play a rank match, the suit changes to your card's suit.
                                    Special suit-change cards act as wildcards.
                                </p>
                            </div>
                        </div>
                    </motion.section>

                    {/* Section 3: Punishments */}
                    <motion.section variants={itemVariants} className="space-y-6">
                        <div className="flex items-center gap-3 text-2xl font-bold text-white">
                            <AlertTriangle className="text-red-500" />
                            <h2>Punishment Protocols</h2>
                        </div>
                        <div className="space-y-4 ml-2">
                            <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg">
                                <h3 className="text-red-400 font-bold text-lg mb-3">The Ace of Spades</h3>
                                <p className="text-gray-300">
                                    The ultimate punishment card. Playing this (or specific punishment cards) forces the next player to draw cards.
                                    Punishments can stack or be overruled if specific counter-cards (like other punishment cards) are played in response.
                                </p>
                            </div>

                            <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg">
                                <h3 className="text-red-400 font-bold text-lg mb-3">Rank 2 Punishment</h3>
                                <p className="text-gray-300">
                                    Rank 2 cards may also initiate punishment chains. If a chain exists, playing another Rank 2 adds to the penalty for the next player.
                                </p>
                            </div>
                        </div>
                    </motion.section>

                    {/* Section 4: Blunders & Crazy */}
                    <motion.section variants={itemVariants} className="space-y-6">
                        <div className="flex items-center gap-3 text-2xl font-bold text-white">
                            <span className="text-purple-400 font-mono">⚠️</span>
                            <h2>Blunders & "Crazy"</h2>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-lg ml-2 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle size={100} />
                            </div>
                            <ul className="space-y-4 text-gray-300 relative z-10">
                                <li className="flex gap-3">
                                    <span className="text-purple-400 font-bold">•</span>
                                    <span>
                                        <strong>Illegal Moves:</strong> Playing the wrong suit, ranking inappropriately, or creating an invalid multi-card throw triggers an "Illegal Turn Penalty".
                                    </span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-purple-400 font-bold">•</span>
                                    <span>
                                        <strong>Calling "Crazy":</strong> If you blunder, other players can call "Crazy!". If they call it before you revert your move, you draw penalty cards.
                                    </span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-purple-400 font-bold">•</span>
                                    <span>
                                        <strong>Revert:</strong> If you realize your mistake and say "Revert" before anyone calls "Crazy", you take back your card without penalty.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </motion.section>

                    {/* Section 5: Multi-Card Throws */}
                    <motion.section variants={itemVariants} className="space-y-6">
                        <div className="flex items-center gap-3 text-2xl font-bold text-white">
                            <span className="text-blue-400 font-mono">📚</span>
                            <h2>Multi-Card Overdrive</h2>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-lg ml-2">
                            <p className="text-gray-300 mb-4">
                                You can throw multiple cards at once if they adhere to strict protocols:
                            </p>
                            <ul className="grid gap-3 text-sm text-gray-400">
                                <li className="bg-black/40 p-3 rounded border border-white/5">All cards must match the current Suit or Rank properly.</li>
                                <li className="bg-black/40 p-3 rounded border border-white/5">You cannot mix different suits in a single throw unless specific rules allow (e.g. Drop Cards).</li>
                                <li className="bg-black/40 p-3 rounded border border-white/5">In valid scenarios (Drop Cards), you may be able to drop all cards of the same suit.</li>
                            </ul>
                        </div>
                    </motion.section>

                </motion.div>
            </div>
        </main>
    );
}
