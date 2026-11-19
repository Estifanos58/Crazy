import { expect, test } from '@playwright/test';

test.describe('Multiplayer Room Lifecycle, Gameplay & Reconnection', () => {
  test('two players create/join a room, play cards, draw/pass, reconnect mid-match, and end the room', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const alicePage = await hostContext.newPage();
    const bobPage = await guestContext.newPage();

    try {
      // 1. Alice creates a room from the landing page
      await alicePage.goto('/');
      await alicePage.getByRole('button', { name: /Create a Table/i }).click();
      await alicePage.getByLabel(/Display Name/i).fill('Alice');
      await alicePage.getByRole('dialog').getByRole('button', { name: /Create Table/i }).click();

      await alicePage.waitForURL(/\/room\/[A-Z0-9]+/);
      const roomUrl = alicePage.url();
      const roomId = roomUrl.split('/room/')[1].split('?')[0];
      expect(roomId.length).toBeGreaterThanOrEqual(4);

      // Host Start Match button is disabled with only 1 player seated
      const startBtn = alicePage.getByRole('button', { name: /Start Match/i });
      await expect(startBtn).toBeDisabled();

      // 2. Bob joins the room via code from the landing page
      await bobPage.goto('/');
      await bobPage.getByRole('button', { name: /Join with Code/i }).click();
      await bobPage.getByLabel(/Room Code or Invite Link/i).fill(roomId);
      await bobPage.getByRole('button', { name: /Continue/i }).click();
      await bobPage.getByLabel(/Display Name/i).fill('Bob');
      await bobPage.getByRole('dialog').getByRole('button', { name: /Join Table/i }).click();

      await bobPage.waitForURL(new RegExp(`/room/${roomId}`));
      await expect(bobPage.getByText('Alice', { exact: true })).toBeVisible();
      await expect(bobPage.getByText('Bob', { exact: true })).toBeVisible();

      // 3. Alice starts the match; both navigate to the card table
      await expect(startBtn).toBeEnabled();
      await startBtn.click();

      await Promise.all([
        alicePage.waitForURL(new RegExp(`/game/${roomId}`)),
        bobPage.waitForURL(new RegExp(`/game/${roomId}`)),
      ]);

      // Verify turn ownership and private hands (Alice starts with 8 cards, Bob with 7)
      await expect(alicePage.getByText('Your Turn')).toBeVisible();
      await expect(bobPage.getByText("Alice's Turn")).toBeVisible();

      const aliceCards = alicePage.getByRole('group', { name: /Your playing cards/i }).getByRole('button');
      const bobCards = bobPage.getByRole('group', { name: /Your playing cards/i }).getByRole('button');
      await expect(aliceCards).toHaveCount(8);
      await expect(bobCards).toHaveCount(7);

      // 4. Alice plays an opening card (choosing a suit if it happens to be a J or 8)
      await aliceCards.first().click();
      await alicePage.getByRole('button', { name: /Play Card/i }).click();

      const suitDialog = alicePage.getByRole('dialog', { name: /Declare Active Suit/i });
      if (await suitDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suitDialog.getByRole('button', { name: /Hearts/i }).click();
      }

      // Alice now has 7 cards; if not a 5/7 skip/reverse in 2-player, Bob gets the turn
      await expect(aliceCards).toHaveCount(7);

      // 5. Bob reloads the browser mid-match and reconnects authoritatively
      await bobPage.reload();
      await bobPage.waitForURL(new RegExp(`/game/${roomId}`));
      await expect(bobCards).toHaveCount(7);

      // If it's Bob's turn, exercise either Take +N (if Alice opened with A♠/2) or Draw -> Pass
      if (await bobPage.getByText('Your Turn').isVisible().catch(() => false)) {
        const drawBtn = bobPage.getByRole('button', { name: /Draw Card/i });
        const takeBtn = bobPage.getByRole('button', { name: /Take \+\d+/i });
        if (await takeBtn.isVisible().catch(() => false)) {
          await takeBtn.click();
          await expect(bobCards).not.toHaveCount(7);
        } else {
          await drawBtn.click();
          await expect(bobCards).toHaveCount(8);
          await bobPage.getByRole('button', { name: /Pass Turn/i }).click();
          await expect(alicePage.getByText('Your Turn')).toBeVisible();
        }
      }

      // 6. Host ends the match -> both return to home
      await alicePage.getByRole('button', { name: /End Match/i }).click();
      await alicePage.getByRole('dialog').getByRole('button', { name: /End Room/i }).click();

      await alicePage.waitForURL(/\/$/);
      await bobPage.waitForURL(/\/$/, { timeout: 10_000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
