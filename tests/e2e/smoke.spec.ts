import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OPPONENT_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
];

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

    // Assert bounding box fits inside viewport and width is 256 * k
    const vp = page.viewportSize() || { width: 1280, height: 720 };
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);

      // Width is integer multiple of 256 (256 * k)
      const k = box.width / 256;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(0.01);
      expect(Math.round(k)).toBeGreaterThanOrEqual(1);
    }

    // Assert top 48 rows contain non-black pixels via getImageData
    const hasHudPixels = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      if (!ctx) return false;
      const imgData = ctx.getImageData(0, 0, 256, 48);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        if (r > 0 || g > 0 || b > 0) return true;
      }
      return false;
    });
    expect(hasHudPixels).toBe(true);

    // Assert no unhandled page errors
    expect(pageErrors).toHaveLength(0);

    // Save screenshot to screenshots/smoke-<opponent_id>.png per requirement 8
    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, `smoke-${opponentId}.png`);
    await page.screenshot({ path: screenshotPath });
  });
}
