import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Real knockdown in play', () => {
  test('knockdown against aint_man with debug=lowhp', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Requirement 9:
    // Add a debug query ?debug=lowhp&opp=<id> that starts a fight against <id> with opponent at 1 HP.
    // tests/e2e/knockdown.spec.ts uses it for aint_man.
    // Waits for PLAYING, presses punch keys until data-game-state or a new data-referee-count attribute shows a knockdown,
    // and saves screenshots/knockdown-aint_man.png showing opponent down and referee count.
    await page.goto('./?debug=lowhp&opp=aint_man');

    // Wait until state reaches PLAYING
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 15000 }
    );

    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    // Repeatedly press punch key (Z or X) until opponent is knocked down
    // Check either data-referee-count > 0 or referee count visual/state
    let knockedDown = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(60);

      const countAttr = await page.locator('[data-game-state]').getAttribute('data-referee-count');
      const count = countAttr ? parseInt(countAttr, 10) : 0;
      if (count > 0) {
        knockedDown = true;
        break;
      }
    }

    // Wait until referee count reaches at least 2
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-game-state]');
        const count = el?.getAttribute('data-referee-count');
        return count && parseInt(count, 10) >= 2;
      },
      null,
      { timeout: 10000 }
    );

    // Wait a brief moment for referee count digit to be clearly visible on canvas
    await page.waitForTimeout(100);

    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, 'knockdown-aint_man.png');
    await canvas.screenshot({ path: screenshotPath });

    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(pageErrors).toHaveLength(0);

    // Read the screenshot and verify count digit pixels and opponent in fallen position
    const { Jimp } = await import('jimp');
    const img = await Jimp.read(screenshotPath);
    if (img.bitmap.width !== 256 || img.bitmap.height !== 240) {
      img.resize({ w: 256, h: 240 });
    }

    // 1. Assert count digits are drawn (non-background pixels in count area y: 52..76, x: 100..156)
    let countDigitPixels = 0;
    for (let y = 56; y <= 72; y++) {
      for (let x = 110; x <= 146; x++) {
        const p = img.getPixelColor(x, y);
        const r = (p >> 24) & 0xff;
        const g = (p >> 16) & 0xff;
        const b = (p >> 8) & 0xff;
        // The count digit is drawn in gold/yellow (0x28) or white (0x20)
        // Background bar is pure black (0,0,0)
        if (r > 100 || g > 100) {
          countDigitPixels++;
        }
      }
    }
    expect(countDigitPixels, 'Count digit pixels should be visible in message bar area').toBeGreaterThan(10);

    // 2. Assert opponent is in fallen position (opponent sprite shifted down onto the canvas mat)
    // Floor boundary is y = 190. Fallen opponent pixels should be between y = 130 and 190
    let fallenOpponentPixels = 0;
    for (let y = 130; y < 190; y++) {
      for (let x = 60; x < 196; x++) {
        const p = img.getPixelColor(x, y);
        const r = (p >> 24) & 0xff;
        const g = (p >> 16) & 0xff;
        const b = (p >> 8) & 0xff;
        const isMat = (r === 0 && g === 136 && b === 136) || (r === 0 && g === 147 && b === 147);
        const isBlack = (r === 0 && g === 0 && b === 0);
        const isRope = (r === 181 && g === 49 && b === 32) || (r === 254 && g === 254 && b === 254) || (r === 0 && g === 30 && b === 116);
        if (!isMat && !isBlack && !isRope) {
          fallenOpponentPixels++;
        }
      }
    }
    expect(fallenOpponentPixels, 'Opponent should have pixels visible in fallen ring mat position').toBeGreaterThan(50);
  });
});
