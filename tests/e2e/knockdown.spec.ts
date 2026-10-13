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

    // Mash punch until the opponent is knocked down and the referee counts
    for (let attempt = 0; attempt < 40; attempt++) {
      const countAttr = await page.locator('[data-game-state]').getAttribute('data-referee-count');
      if (countAttr && parseInt(countAttr, 10) >= 1) break;
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(60);
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

    // Capture until the drawn count digit matches the current data-referee-count
    let count = 0;
    let live: PNG | null = null;
    let ok = false;
    for (let attempt = 0; attempt < 8 && !ok; attempt++) {
      const attr = await page.locator('[data-game-state]').getAttribute('data-referee-count');
      count = attr ? parseInt(attr, 10) : 0;
      if (count < 2) {
        await page.waitForTimeout(80);
        continue;
      }
      await canvas.screenshot({ path: screenshotPath });
      live = readPng(screenshotPath);
      ok = digitMatches(live, count);
      if (!ok) await page.waitForTimeout(60);
    }

    expect(count, 'referee count reached at least 2').toBeGreaterThanOrEqual(2);
    expect(ok, 'count digit matches the referee count sprite at its drawn position').toBe(true);

    const k = live!.width / 256;
    expect(Number.isInteger(k), `canvas scale factor is integer (width=${live!.width})`).toBe(true);

    // Empty reference frame: the KO pose blinks off at actionFrame 44, so the opponent
    // is not drawn (same technique as poses.spec.ts).
    await page.goto(`./?pose=${OPP}&action=KO&player=IDLE&frame=44`);
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(80);
    await canvas.screenshot({ path: emptyPath });
    const empty = readPng(emptyPath);
    expect(empty.width, 'reference frame has the same scale').toBe(live!.width);

    // Find the topmost row where the live frame differs from the opponent-less reference.
    // Scan the ring area x 60-196 below the crowd flash (y >= 88), skipping the referee box.
    let top = -1;
    for (let y = 88; y < 240 && top < 0; y++) {
      for (let x = 60; x < 196; x++) {
        if (x >= REFEREE_BOX.x0 && x <= REFEREE_BOX.x1 && y >= REFEREE_BOX.y0 && y <= REFEREE_BOX.y1) {
          continue;
        }
        if (!same(blockPx(live!, x, y, k), blockPx(empty, x, y, k))) {
          top = y;
          break;
        }
      }
    }

    expect(top, 'opponent is drawn (diff vs empty reference found)').toBeGreaterThan(0);
    expect(top, 'knocked-down opponent is low on the ring floor (top row >= 140)').toBeGreaterThanOrEqual(140);

    // (b) The fallen opponent is drawn in his own (dark) colors, not a white silhouette.
    // Opponent-only region: above the player (y <= 167) and below the crowd (y >= 88).
    const white20 = nesToRgba(0x20);
    const white30 = nesToRgba(0x30);
    let opponentPixels = 0;
    let whitePixels = 0;
    for (let y = 88; y <= 167; y++) {
      for (let x = 60; x < 196; x++) {
        if (x >= REFEREE_BOX.x0 && x <= REFEREE_BOX.x1 && y >= REFEREE_BOX.y0 && y <= REFEREE_BOX.y1) {
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
    expect(whitePixels / opponentPixels, 'fallen opponent is not a white silhouette (< 5% white)').toBeLessThan(0.05);

    // (c) The player stands aside: his leftmost pixel below the ring floor is at x >= 152.
    const mat = nesToRgba(0x19);
    let playerLeft = -1;
    for (let y = 190; y < 240; y++) {
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
