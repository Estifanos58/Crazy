import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/Modal';

function ModalHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Dialog
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Table Settings"
        description="Configure your match options."
        dismissible={dismissible}
      >
        <input aria-label="Room Note" type="text" />
        <button type="button" onClick={() => setOpen(false)}>
          Confirm
        </button>
      </Modal>
    </div>
  );
}

describe('Modal accessibility and focus management', () => {
  it('moves focus into modal on open, traps Tab/Shift+Tab, and restores focus on close', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Table Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-describedby');

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const input = screen.getByLabelText('Room Note');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });

    // Initial focus moves to first focusable element inside the modal
    expect(closeBtn).toHaveFocus();

    // Tab cycles forward and wraps from last back to first
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab();
    expect(confirmBtn).toHaveFocus();
    await user.tab();
    expect(closeBtn).toHaveFocus();

    // Shift+Tab wraps backward from first to last
    await user.tab({ shift: true });
    expect(confirmBtn).toHaveFocus();

    // Pressing Escape closes dialog and restores focus to original trigger
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not dismiss non-dismissible modals on Escape', async () => {
    const user = userEvent.setup();
    render(<ModalHarness dismissible={false} />);

    await user.click(screen.getByRole('button', { name: 'Open Dialog' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
