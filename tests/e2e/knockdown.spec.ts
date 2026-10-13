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

    // If count attribute is still 0, wait a few frames for referee count to increment
    if (!knockedDown) {
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-game-state]');
          const count = el?.getAttribute('data-referee-count');
          return count && parseInt(count, 10) > 0;
        },
        null,
        { timeout: 5000 }
      );
    }

    // Wait a brief moment for referee count digit to be clearly visible on canvas
    await page.waitForTimeout(300);

    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, 'knockdown-aint_man.png');
    await canvas.screenshot({ path: screenshotPath });

    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(pageErrors).toHaveLength(0);
  });
});
