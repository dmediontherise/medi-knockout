import { test, expect } from '@playwright/test';

const OPPONENT_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

for (const opponentId of OPPONENT_IDS) {
  test(`smoke test fight against ${opponentId}`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./');

    // Verify Menu is displayed
    const enterRingButton = page.locator('[data-testid="enter-ring-button"]');
    await expect(enterRingButton).toBeVisible();

    // Start fight with this opponent
    const opponentButton = page.locator(`[data-testid="select-opponent-${opponentId}"]`);
    await expect(opponentButton).toBeVisible();
    await opponentButton.click();

    // Wait until fight is in progress (ENTRANCE -> ROUND_START -> PLAYING)
    // Wait for data-game-state="PLAYING" per spec requirement
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 15000 }
    );

    // Wait for the round clock to advance >= 1s (1200ms)
    await page.waitForTimeout(1200);

    // Verify the canvas is visible
    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    // Assert no unhandled page errors
    expect(pageErrors).toHaveLength(0);

    // Save screenshot
    await page.screenshot({ path: `test-results/smoke-${opponentId}.png` });
  });
}
