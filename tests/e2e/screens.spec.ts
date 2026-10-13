import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { NES_PALETTE } from '../../src/render/nesPalette';

function isNesRgb(r: number, g: number, b: number): boolean {
  return NES_PALETTE.some(([nr, ng, nb]) => nr === r && ng === g && nb === b);
}

function verifyPngNesPalette(filePath: string): void {
  const fileData = fs.readFileSync(filePath);
  const png = PNG.sync.read(fileData);

  const invalidColors = new Set<string>();
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      if (!isNesRgb(r, g, b)) {
        invalidColors.add(`rgb(${r},${g},${b}) at (${x},${y})`);
        if (invalidColors.size >= 5) break;
      }
    }
    if (invalidColors.size >= 5) break;
  }

  expect(Array.from(invalidColors), `Found non-NES palette pixels in ${filePath}`).toEqual([]);
}

test.describe('Presentation screens e2e (Task 009 Req 11)', () => {
  const screensDir = path.resolve(process.cwd(), 'screenshots/screens');

  test.beforeAll(() => {
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test('drives title -> circuit -> pick dj_tito -> intro card -> PLAYING', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // 1. Title Screen
    await page.goto('./?unlock=all');
    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'MENU',
      null,
      { timeout: 10000 }
    );

    // Capture Title Screen screenshot
    const titlePath = path.join(screensDir, 'title.png');
    await canvas.screenshot({ path: titlePath });
    expect(fs.existsSync(titlePath)).toBe(true);
    verifyPngNesPalette(titlePath);

    // 2. Advance to Circuit Select (Press Enter or Space)
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('[data-screen-mode]')?.getAttribute('data-screen-mode') === 'CIRCUIT',
      null,
      { timeout: 10000 }
    );

    // Capture Circuit Screen screenshot
    const circuitPath = path.join(screensDir, 'circuit.png');
    await canvas.screenshot({ path: circuitPath });
    expect(fs.existsSync(circuitPath)).toBe(true);
    verifyPngNesPalette(circuitPath);

    // 3. Navigate to dj_tito (index 2: aint_man -> medi_jinx -> dj_tito)
    // Press ArrowDown twice and wait for circuit selection index to update
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(
      () => document.querySelector('[data-circuit-selected]')?.getAttribute('data-circuit-selected') === '1',
      null,
      { timeout: 5000 }
    );
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(
      () => document.querySelector('[data-circuit-selected]')?.getAttribute('data-circuit-selected') === '2',
      null,
      { timeout: 5000 }
    );

    // Press Enter to pick DJ Tito
    await page.keyboard.press('Enter');

    // 4. Wait for ENTRANCE (Intro Card)
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'ENTRANCE',
      null,
      { timeout: 10000 }
    );

    // Capture Intro Card screenshot
    const introPath = path.join(screensDir, 'intro-dj_tito.png');
    await canvas.screenshot({ path: introPath });
    expect(fs.existsSync(introPath)).toBe(true);
    verifyPngNesPalette(introPath);

    // 5. Press Enter to advance to PLAYING
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 15000 }
    );

    expect(pageErrors).toHaveLength(0);
  });

  test('drives title -> debug=lowhp&opp=aint_man -> win -> result-win screen', async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./?debug=lowhp&opp=aint_man');
    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    // Wait until PLAYING
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 15000 }
    );

    // Punch opponent until VICTORY. Poll the observable game state while mashing
    // instead of sleeping a fixed 500 ms between presses. Hold HEAD (ArrowUp) so KeyZ
    // is a head punch that lands past the debug opponent's LOW guard (faster, larger
    // margin). Read the state BEFORE pressing: a punch key (z) also advances/dismisses
    // menu and result screens, so pressing after the match ends would dismiss VICTORY
    // before we can observe it.
    // If opponent gets knocked down, referee counts to 10 or opponent gets up and is punched down again.
    await page.keyboard.down('ArrowUp');
    try {
      await expect
        .poll(
          async () => {
            const state = await page.locator('[data-game-state]').getAttribute('data-game-state');
            if (state === 'PLAYING') {
              await page.keyboard.press('KeyZ');
            }
            return state;
          },
          { timeout: 45000, intervals: [200, 300, 400] }
        )
        .toBe('VICTORY');
    } finally {
      await page.keyboard.up('ArrowUp');
    }

    // Wait for screen mode to observe RESULTS
    await page.waitForFunction(
      () => document.querySelector('[data-screen-mode]')?.getAttribute('data-screen-mode') === 'RESULTS',
      null,
      { timeout: 5000 }
    );

    const resultPath = path.join(screensDir, 'result-win.png');
    await canvas.screenshot({ path: resultPath });
    expect(fs.existsSync(resultPath)).toBe(true);
    verifyPngNesPalette(resultPath);

    expect(pageErrors).toHaveLength(0);
  });

  test('captures between-rounds screen via ?debug=betweenrounds&opp=dj_tito', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./?debug=betweenrounds&opp=dj_tito');
    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    // Task 010 Req 12: capture on a visible blink frame of "PRESS START"
    // (between-rounds blinks floor(frame/20) % 2 === 0; screenshotting a blink-off
    // frame would miss the prompt entirely).
    await page.waitForFunction(
      () => {
        const el = document.querySelector('canvas.game-canvas') as HTMLCanvasElement | null;
        const ctx = el?.getContext('2d');
        if (!ctx) return false;
        const img = ctx.getImageData(84, 212, 88, 8).data;
        for (let i = 0; i < img.length; i += 4) {
          // NES 0x28 => rgb(0xbc, 0xbe, 0x00)
          if (img[i] === 0xbc && img[i + 1] === 0xbe && img[i + 2] === 0x00) return true;
        }
        return false;
      },
      null,
      { timeout: 5000 }
    );

    const betweenRoundsPath = path.join(screensDir, 'between-rounds.png');
    await canvas.screenshot({ path: betweenRoundsPath });
    expect(fs.existsSync(betweenRoundsPath)).toBe(true);
    verifyPngNesPalette(betweenRoundsPath);

    // Task 015 Requirement 5:
    // the ?debug=betweenrounds screen is still shown after 5 s
    await page.waitForTimeout(5000);
    const container = page.locator('[data-round="1"]');
    await expect(container).toBeVisible();

    // after Enter the fight is in round 2 (data-round="2" or R2 in HUD)
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('[data-round="2"]') !== null,
      null,
      { timeout: 5000 }
    );

    expect(pageErrors).toHaveLength(0);
  });
});
