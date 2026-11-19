import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardHand from '@/components/CardHand';
import BlunderModal from '@/components/BlunderModal';
import GameOverModal from '@/components/GameOverModal';
import JoinGameModal from '@/components/JoinGameModal';
import type { Card, RankedPlayer } from '@/types/game.types';

describe('Gameplay UI Components', () => {
  it('renders cards with accessible labels, selection state, and click handling', async () => {
    const user = userEvent.setup();
    const cards: Card[] = [
      { id: 'A-spades', rank: 'A', suit: 'spades' },
      { id: '7-hearts', rank: '7', suit: 'hearts' },
    ];
    const onCardClick = vi.fn();

    render(
      <CardHand cards={cards} selectedCards={[cards[0]]} onCardClick={onCardClick} disabled={false} />
    );

    const aceBtn = screen.getByRole('button', { name: /Ace of Spades, selected/i });
    const sevenBtn = screen.getByRole('button', { name: /7 of Hearts/i });

    expect(aceBtn).toHaveAttribute('aria-pressed', 'true');
    expect(sevenBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(sevenBtn);
    expect(onCardClick).toHaveBeenCalledWith(cards[1]);
  });

  it('displays BlunderModal countdown and disables Revert when window expires', async () => {
    const user = userEvent.setup();
    const onRevert = vi.fn();

    const { rerender } = render(
      <BlunderModal
        isOpen
        reason="Card must match suit (hearts)"
        timeLeft={4}
        totalTime={5}
        onRevert={onRevert}
      />
    );

    const revertBtn = screen.getByRole('button', { name: /Revert Move/i });
    expect(revertBtn).toBeEnabled();
    await user.click(revertBtn);
    expect(onRevert).toHaveBeenCalledTimes(1);

    rerender(
      <BlunderModal
        isOpen
        reason="Card must match suit (hearts)"
        timeLeft={0}
        totalTime={5}
        onRevert={onRevert}
      />
    );
    expect(screen.getByRole('button', { name: /Revert Move/i })).toBeDisabled();
  });

  it('shows Play Again only to the host in GameOverModal', () => {
    const rankings: RankedPlayer[] = [
      { id: 'p1', username: 'Alice', avatar: '🦊', rank: 1 },
      { id: 'p2', username: 'Bob', avatar: '🦁', rank: 2 },
    ];

    const { rerender } = render(
      <GameOverModal
        isOpen
        rankings={rankings}
        isCreator={false}
        currentPlayerId="p2"
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Play Again/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for the room host/i)).toBeInTheDocument();

    rerender(
      <GameOverModal
        isOpen
        rankings={rankings}
        isCreator
        currentPlayerId="p1"
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Play Again/i })).toBeEnabled();
  });

  it('extracts room codes from bare input and pasted invite URLs in JoinGameModal', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    render(<JoinGameModal onJoin={onJoin} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/Room Code or Invite Link/i);
    await user.type(input, 'https://crazy.example.com/room/K7P4M2?join=true');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(onJoin).toHaveBeenCalledWith('K7P4M2');
  });
});
