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

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
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

      // Wait for the round clock to advance >= 1s
      await page.waitForTimeout(1200);

      // Verify the canvas is visible
      const canvas = page.locator('canvas.game-canvas');
      await expect(canvas).toBeVisible();

      // Assert bounding box fits inside viewport and width is 256 * k
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);

        const k = box.width / 256;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(0.01);
        const intK = Math.round(k);

        // Requirement 6: At 1280x720 desktop, canvas CSS width is at least 512px (k >= 2)
        // At 390x844 phone, canvas is k >= 1
        if (vp.name === 'desktop') {
          expect(intK).toBeGreaterThanOrEqual(2);
          expect(box.width).toBeGreaterThanOrEqual(512);
        } else {
          expect(intK).toBeGreaterThanOrEqual(1);
        }
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

      // Requirement 10: No DOM element shows feedbackMessage text while data-game-state="PLAYING"
      // Assert no element containing OUCH, FIGHT, GET UP or ROUND text is visible in the DOM during PLAYING
      const forbiddenPatterns = ['OUCH', 'FIGHT', 'GET UP', 'ROUND'];
      for (const pattern of forbiddenPatterns) {
        const matches = await page.locator(`text=${pattern}`).all();
        for (const loc of matches) {
          const isVis = await loc.isVisible();
          expect(isVis, `DOM element containing "${pattern}" should not be visible during PLAYING`).toBe(false);
        }
      }

      // Save screenshot for desktop view (or default)
      if (vp.name === 'desktop') {
        const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        const screenshotPath = path.join(screenshotsDir, `smoke-${opponentId}.png`);
        await page.screenshot({ path: screenshotPath });
      }
    }

    // Assert no unhandled page errors
    expect(pageErrors).toHaveLength(0);
  });
}
