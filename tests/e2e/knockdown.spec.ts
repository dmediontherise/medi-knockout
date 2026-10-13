import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { nesToRgba } from '../../src/render/nesPalette';
import { getLargeCountDigitSprite } from '../../src/render/sprites/referee';
import { COUNT_DIGIT_X, COUNT_DIGIT_Y } from '../../src/render/renderFrame';

const OPP = 'aint_man';

// Referee sprite is blitted at (48, 88) with size 32x48 -> x 48..79, y 88..135.
const REFEREE_BOX = { x0: 44, x1: 84, y0: 84, y1: 141 };

function readPng(filePath: string) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function blockPx(png: PNG, x: number, y: number, k: number): [number, number, number] {
  const px = Math.min(png.width - 1, x * k + Math.floor(k / 2));
  const py = Math.min(png.height - 1, y * k + Math.floor(k / 2));
  const idx = (png.width * py + px) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

function same(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// Compares every opaque pixel of the large count-digit sprite at its drawn position.
function digitMatches(png: PNG, count: number): boolean {
  const k = png.width / 256;
  if (!Number.isInteger(k)) return false;
  const digit = getLargeCountDigitSprite(count);
  const [er, eg, eb] = nesToRgba(0x38);
  let any = false;
  for (let sy = 0; sy < digit.height; sy++) {
    const row = digit.rows[sy];
    for (let sx = 0; sx < digit.width; sx++) {
      const ch = row[sx];
      if (ch === '.' || ch === ' ') continue;
      const p = blockPx(png, COUNT_DIGIT_X + sx, COUNT_DIGIT_Y + sy, k);
      if (p[0] !== er || p[1] !== eg || p[2] !== eb) return false;
      any = true;
    }
  }
  return any;
}

test.describe('Real knockdown in play', () => {
  test('knockdown against aint_man with debug=lowhp', async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./?debug=lowhp&opp=aint_man');

    // Wait until state reaches PLAYING
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 15000 }
    );

    const canvas = page.locator('canvas.game-canvas');
    await expect(canvas).toBeVisible();

    // Mash punch until the opponent is knocked down and the referee starts counting.
    // Poll the observable data-referee-count instead of pacing with a fixed sleep.
    // Hold HEAD so KeyZ is a head punch that lands past the debug opponent's LOW guard.
    // Read state before pressing (z also advances menus; only mash while PLAYING).
    await page.keyboard.down('ArrowUp');
    try {
      await expect
        .poll(
          async () => {
            const el = page.locator('[data-game-state]');
            const state = await el.getAttribute('data-game-state');
            const attr = await el.getAttribute('data-referee-count');
            const count = attr ? parseInt(attr, 10) : 0;
            if (count >= 1) return count;
            if (state === 'PLAYING') {
              await page.keyboard.press('KeyZ');
            }
            return count;
          },
          { timeout: 30000, intervals: [60, 90, 120, 150] }
        )
        .toBeGreaterThanOrEqual(1);
    } finally {
      await page.keyboard.up('ArrowUp');
    }

    // Wait until referee count reaches at least 2 (opponent clearly on the canvas)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-game-state]');
        const count = el?.getAttribute('data-referee-count');
        return count && parseInt(count, 10) >= 2;
      },
      null,
      { timeout: 10000 }
    );

    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, 'knockdown-aint_man.png');
    const emptyPath = path.join(screenshotsDir, '.knockdown-empty-reference.png');

    // Capture until the drawn count digit matches the current data-referee-count.
    // Poll the observable attribute and the drawn canvas instead of fixed sleeps.
    let count = 0;
    let live: PNG | null = null;
    await expect
      .poll(
        async () => {
          const attr = await page.locator('[data-game-state]').getAttribute('data-referee-count');
          count = attr ? parseInt(attr, 10) : 0;
          if (count < 2) return false;
          await canvas.screenshot({ path: screenshotPath });
          live = readPng(screenshotPath);
          return digitMatches(live, count);
        },
        { timeout: 15000, intervals: [100, 150, 200, 250] }
      )
      .toBe(true);

    expect(count, 'referee count reached at least 2').toBeGreaterThanOrEqual(2);

    const k = live!.width / 256;
    expect(Number.isInteger(k), `canvas scale factor is integer (width=${live!.width})`).toBe(true);

    // Empty reference frame: the KO pose blinks off at actionFrame 44, so the opponent
    // is not drawn (same technique as poses.spec.ts).
    await page.goto(`./?pose=${OPP}&action=KO&player=IDLE&frame=44`);
    await expect(canvas).toBeVisible();
    // Pose preview: wait for the preview state, then for the canvas to have drawn it.
    await page.waitForFunction(
      () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
      null,
      { timeout: 10000 }
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    );
    await canvas.screenshot({ path: emptyPath });
    const empty = readPng(emptyPath);
    expect(empty.width, 'reference frame has the same scale').toBe(live!.width);

    // Find the opponent's bounding box where the live frame differs from the opponent-less reference.
    // Scan the ring area x 50-205 below the crowd flash (y >= 88), skipping the referee box and player area (x >= 152 and y >= 135).
    let minOppX = 256, maxOppX = -1, minOppY = 240, maxOppY = -1;
    let diffCount = 0;
    for (let y = 88; y <= 192; y++) {
      for (let x = 50; x < 205; x++) {
        if (x >= REFEREE_BOX.x0 && x <= REFEREE_BOX.x1 && y >= REFEREE_BOX.y0 && y <= REFEREE_BOX.y1) {
          continue;
        }
        if (x >= 152 && y >= 135) {
          continue;
        }
        if (!same(blockPx(live!, x, y, k), blockPx(empty, x, y, k))) {
          diffCount++;
          if (x < minOppX) minOppX = x;
          if (x > maxOppX) maxOppX = x;
          if (y < minOppY) minOppY = y;
          if (y > maxOppY) maxOppY = y;
        }
      }
    }

    expect(diffCount, 'opponent is drawn (diff vs empty reference found)').toBeGreaterThan(100);
    const oppWidth = maxOppX - minOppX + 1;
    const oppHeight = maxOppY - minOppY + 1;
    expect(oppWidth, 'opponent pixel bounding box is wider than it is tall').toBeGreaterThan(oppHeight);
    expect(maxOppY, 'opponent bottom is <= y 192').toBeLessThanOrEqual(192);

    // (b) The fallen opponent is drawn in his own (dark) colors, not a white silhouette.
    // Opponent-only region: above the player's lower body/step aside (skipping x >= 152) and below the crowd (y >= 88).
    const white20 = nesToRgba(0x20);
    const white30 = nesToRgba(0x30);
    let opponentPixels = 0;
    let whitePixels = 0;
    for (let y = 88; y <= 167; y++) {
      for (let x = 60; x < 196; x++) {
        if (x >= REFEREE_BOX.x0 && x <= REFEREE_BOX.x1 && y >= REFEREE_BOX.y0 && y <= REFEREE_BOX.y1) {
          continue;
        }
        if (x >= 152 && y >= 135) {
          continue;
        }
        const livePx = blockPx(live!, x, y, k);
        if (same(livePx, blockPx(empty, x, y, k))) continue;
        opponentPixels++;
        if (same(livePx, [white20[0], white20[1], white20[2]]) || same(livePx, [white30[0], white30[1], white30[2]])) {
          whitePixels++;
        }
      }
    }
    expect(opponentPixels, 'opponent pixels measured above the player').toBeGreaterThan(0);
    expect(whitePixels / opponentPixels, 'fallen opponent is not a white silhouette (< 15% white)').toBeLessThan(0.15);

    // (c) The player stands aside: his leftmost pixel below the ring floor (y >= 193) is at x >= 152.
    const mat = nesToRgba(0x19);
    let playerLeft = -1;
    for (let y = 193; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        if (same(blockPx(live!, x, y, k), [mat[0], mat[1], mat[2]])) continue;
        if (playerLeft < 0 || x < playerLeft) playerLeft = x;
      }
    }
    expect(playerLeft, 'player left edge below the floor is at x >= 152').toBeGreaterThanOrEqual(152);

    fs.rmSync(emptyPath, { force: true });
    expect(pageErrors).toHaveLength(0);
  });
});
