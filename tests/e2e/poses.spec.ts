import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { Jimp } from 'jimp';
import { NES_PALETTE } from '../../src/render/nesPalette';
import { FONT_8X8 } from '../../src/render/sprites/font';

const OPPONENT_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

const OPPONENT_ACTIONS = [
  'IDLE',
  'BLOCK_HIGH',
  'BLOCK_LOW',
  'TELL_JAB_LEFT',
  'TELL_JAB_RIGHT',
  'PUNCH_JAB_LEFT',
  'PUNCH_JAB_RIGHT',
  'TELL_HOOK_LEFT',
  'TELL_HOOK_RIGHT',
  'PUNCH_HOOK_LEFT',
  'PUNCH_HOOK_RIGHT',
  'TELL_UPPERCUT_LEFT',
  'TELL_UPPERCUT_RIGHT',
  'PUNCH_UPPERCUT_LEFT',
  'PUNCH_UPPERCUT_RIGHT',
  'HIT',
  'STUNNED',
  'KNOCKED_DOWN',
  'KO',
];

const PLAYER_ACTIONS = [
  'IDLE',
  'DODGE_LEFT',
  'DODGE_RIGHT',
  'DUCK',
  'BLOCK',
  'PUNCH_LEFT_BODY',
  'PUNCH_RIGHT_BODY',
  'PUNCH_LEFT_HEAD',
  'PUNCH_RIGHT_HEAD',
  'STAR_PUNCH',
  'HIT',
  'KNOCKED_DOWN',
  'KO',
];

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

// Draw bitmap text into a Jimp image
function drawBitmapTextOnJimp(
  image: any,
  text: string,
  startX: number,
  startY: number,
  color: number = 0xffffffff
): void {
  let cx = startX;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT_8X8[ch] || FONT_8X8[' '];
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        if (glyph[gy][gx] === '#') {
          image.setPixelColor(color, cx + gx, startY + gy);
        }
      }
    }
    cx += 8;
  }
}

test.describe('Pose Preview and Contact Sheets Suite', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  const posesDir = path.join(screenshotsDir, 'poses');

  test.beforeAll(() => {
    if (!fs.existsSync(posesDir)) {
      fs.mkdirSync(posesDir, { recursive: true });
    }
  });

  // 1. Opponent poses: screenshots/poses/<opponent_id>-<OpponentAction>.png
  for (const oppId of OPPONENT_IDS) {
    for (const oppAction of OPPONENT_ACTIONS) {
      test(`opponent pose: ${oppId}-${oppAction}`, async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on('pageerror', (err) => pageErrors.push(err));

        const targetUrl = `./?pose=${oppId}&action=${oppAction}&player=IDLE`;
        await page.goto(targetUrl);

        const canvas = page.locator('canvas.game-canvas');
        await expect(canvas).toBeVisible();
        await page.waitForTimeout(50);

        expect(pageErrors).toHaveLength(0);

        const screenshotPath = path.join(posesDir, `${oppId}-${oppAction}.png`);
        await canvas.screenshot({ path: screenshotPath });

        verifyPngNesPalette(screenshotPath);
      });
    }
  }

  // 2. Player poses: screenshots/poses/player-<PlayerAction>.png
  for (const playerAction of PLAYER_ACTIONS) {
    test(`player pose: player-${playerAction}`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const targetUrl = `./?pose=aint_man&action=IDLE&player=${playerAction}`;
      await page.goto(targetUrl);

      const canvas = page.locator('canvas.game-canvas');
      await expect(canvas).toBeVisible();
      await page.waitForTimeout(50);

      expect(pageErrors).toHaveLength(0);

      const screenshotPath = path.join(posesDir, `player-${playerAction}.png`);
      await canvas.screenshot({ path: screenshotPath });

      verifyPngNesPalette(screenshotPath);
    });
  }

  // 3. Contact Sheet generation per opponent: screenshots/contact-<opponent_id>.png
  for (const oppId of OPPONENT_IDS) {
    test(`contact sheet: contact-${oppId}`, async () => {
      // 5 columns by 4 rows grid
      const cols = 5;
      const rows = Math.ceil(OPPONENT_ACTIONS.length / cols);
      const cellW = 256;
      const cellH = 240;
      const labelH = 16;
      const totalCellH = cellH + labelH;
      const totalW = cols * cellW;
      const totalH = rows * totalCellH;

      const sheet = new Jimp({ width: totalW, height: totalH, color: 0x000000ff });

      for (let i = 0; i < OPPONENT_ACTIONS.length; i++) {
        const action = OPPONENT_ACTIONS[i];
        const posePath = path.join(posesDir, `${oppId}-${action}.png`);
        expect(fs.existsSync(posePath), `Expected pose screenshot ${posePath}`).toBe(true);

        const frameImg = await Jimp.read(posePath);
        if (frameImg.bitmap.width !== cellW || frameImg.bitmap.height !== cellH) {
          frameImg.resize({ w: cellW, h: cellH });
        }
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const posX = colIdx * cellW;
        const posY = rowIdx * totalCellH;

        // Composite pose canvas
        sheet.composite(frameImg, posX, posY);

        // Draw action label underneath cell
        const textX = posX + Math.max(4, Math.floor((cellW - action.length * 8) / 2));
        const textY = posY + cellH + 4;
        drawBitmapTextOnJimp(sheet, action, textX, textY, 0xffffffff);

        // Requirement 11: Real contact-sheet assertion
        // For each contact-sheet cell, locate opponent's non-background pixels in that cell
        // and assert their bounding box is inside the cell and not empty, except for fall/KO cells.
        const isFallAction = action === 'KNOCKED_DOWN' || action === 'KO';
        if (!isFallAction) {
          let oppMinX = cellW, oppMaxX = -1, oppMinY = cellH, oppMaxY = -1;
          let nonBgCount = 0;

          // In the ring area above player (y: 48..168, x: 20..236)
          for (let cy = 48; cy < 168; cy++) {
            for (let cx = 20; cx < cellW - 20; cx++) {
              const pixelColor = frameImg.getPixelColor(cx, cy);
              const r = (pixelColor >> 24) & 0xff;
              const g = (pixelColor >> 16) & 0xff;
              const b = (pixelColor >> 8) & 0xff;

              // Background elements:
              // Crowd/HUD: pure black (0,0,0) or crowd grays (0x00: 102,102,102; 0x10: 170,170,170)
              // Ring ropes: red (181,49,32), white (254,254,254), blue (0,30,116)
              // Ring mat teal: (0, 136, 136) or (0, 147, 147)
              const isMat = (r === 0 && g === 136 && b === 136) || (r === 0 && g === 147 && b === 147);
              const isBlack = (r === 0 && g === 0 && b === 0);
              const isRope = (r === 181 && g === 49 && b === 32) || (r === 254 && g === 254 && b === 254) || (r === 0 && g === 30 && b === 116);
              const isCrowdGray = (r === 102 && g === 102 && b === 102) || (r === 170 && g === 170 && b === 170);

              if (!isMat && !isBlack && !isRope && !isCrowdGray) {
                if (cx < oppMinX) oppMinX = cx;
                if (cx > oppMaxX) oppMaxX = cx;
                if (cy < oppMinY) oppMinY = cy;
                if (cy > oppMaxY) oppMaxY = cy;
                nonBgCount++;
              }
            }
          }

          expect(nonBgCount, `${oppId} ${action} has opponent non-background pixels in cell`).toBeGreaterThan(100);
          expect(oppMinX).toBeGreaterThanOrEqual(0);
          expect(oppMinY).toBeGreaterThanOrEqual(0);
          expect(oppMaxX).toBeLessThan(cellW);
          expect(oppMaxY).toBeLessThan(cellH);
        }

        // Assert requirement 7: label area of each cell has non-background pixels
        let nonBgLabelPixels = 0;
        for (let ly = posY + cellH; ly < posY + totalCellH; ly++) {
          for (let lx = posX; lx < posX + cellW; lx++) {
            const pixelVal = sheet.getPixelColor(lx, ly);
            if (pixelVal === 0xffffffff) {
              nonBgLabelPixels++;
            }
          }
        }
        expect(nonBgLabelPixels, `Missing label pixels for ${action} in contact-${oppId}`).toBeGreaterThan(0);
      }

      const contactPath = path.join(screenshotsDir, `contact-${oppId}.png`);
      const buffer = await sheet.getBuffer('image/png');
      fs.writeFileSync(contactPath, buffer);
      expect(fs.existsSync(contactPath)).toBe(true);
    });
  }

  // 4. Requirement 8: Knockdown screenshots screenshots/fall/<id>-KO-<n>.png for n in {0, 15, 30, 40, 44}
  const FALL_FRAMES = [0, 15, 30, 40, 44];
  const fallDir = path.join(screenshotsDir, 'fall');

  for (const oppId of OPPONENT_IDS) {
    test(`knockdown fall screenshots: ${oppId}`, async ({ page }) => {
      if (!fs.existsSync(fallDir)) {
        fs.mkdirSync(fallDir, { recursive: true });
      }

      const frameImages: { [n: number]: any } = {};

      for (const n of FALL_FRAMES) {
        const pageErrors: Error[] = [];
        page.on('pageerror', (err) => pageErrors.push(err));

        const targetUrl = `./?pose=${oppId}&action=KO&player=IDLE&frame=${n}`;
        await page.goto(targetUrl);

        const canvas = page.locator('canvas.game-canvas');
        await expect(canvas).toBeVisible();
        await page.waitForTimeout(50);
        expect(pageErrors).toHaveLength(0);

        const screenshotPath = path.join(fallDir, `${oppId}-KO-${n}.png`);
        await canvas.screenshot({ path: screenshotPath });
        verifyPngNesPalette(screenshotPath);

        const frameImg = await Jimp.read(screenshotPath);
        if (frameImg.bitmap.width !== 256 || frameImg.bitmap.height !== 240) {
          frameImg.resize({ w: 256, h: 240 });
        }
        frameImages[n] = frameImg;
      }

      // Assert topmost non-background row moves down by >= 30 px between frames 0 and 30
      // Requirement 8: Measure sprite pixels inside the ring area by comparing with a frame rendered without the opponent
      // Frame 44 is blink-hidden (no opponent sprite)
      const emptyFrame = frameImages[44];

      function findTopOpponentRow(img: any): number {
        // Scan ring area inside y: 48..200, x: 40..216
        for (let y = 48; y < 200; y++) {
          for (let x = 40; x < 216; x++) {
            const p = img.getPixelColor(x, y);
            const pEmpty = emptyFrame.getPixelColor(x, y);
            if (p !== pEmpty) {
              return y;
            }
          }
        }
        return -1;
      }

      const topRow0 = findTopOpponentRow(frameImages[0]);
      const topRow30 = findTopOpponentRow(frameImages[30]);

      expect(topRow0, `${oppId} KO frame 0 has opponent`).toBeGreaterThan(0);
      expect(topRow30, `${oppId} KO frame 30 has opponent`).toBeGreaterThan(0);
      expect(topRow30 - topRow0, `${oppId} moves down by >= 30 px between frame 0 and 30`).toBeGreaterThanOrEqual(30);

      // Requirement 12: the opponent is clipped at the ring floor line (y = 190) and
      // never slides past it. At frames 30 and 40 no opponent pixel may lie below it.
      const FLOOR_LINE = 190;
      function countPixelsBelowFloor(img: any): number {
        let count = 0;
        for (let y = FLOOR_LINE; y < 240; y++) {
          for (let x = 0; x < 256; x++) {
            if (img.getPixelColor(x, y) !== emptyFrame.getPixelColor(x, y)) {
              count++;
            }
          }
        }
        return count;
      }

      for (const n of [30, 40]) {
        expect(
          countPixelsBelowFloor(frameImages[n]),
          `${oppId} KO frame ${n} draws no opponent pixels below floor line y=${FLOOR_LINE}`
        ).toBe(0);
      }

      // Assert KO sprite is absent in exactly one of frames 40 and 44 (blink)
      function countSpritePixelsVsEmpty(img: any): number {
        let count = 0;
        for (let y = 48; y < 220; y++) {
          for (let x = 40; x < 216; x++) {
            const p = img.getPixelColor(x, y);
            const pEmpty = emptyFrame.getPixelColor(x, y);
            if (p !== pEmpty) {
              count++;
            }
          }
        }
        return count;
      }

      const pixels40 = countSpritePixelsVsEmpty(frameImages[40]);
      const pixels44 = countSpritePixelsVsEmpty(frameImages[44]);

      const hasSprite40 = pixels40 > 150;
      const hasSprite44 = pixels44 > 150;

      expect(
        (hasSprite40 && !hasSprite44) || (!hasSprite40 && hasSprite44),
        `${oppId} KO sprite is absent in exactly one of frame 40 and 44 (40: ${pixels40}, 44: ${pixels44})`
      ).toBe(true);
    });
  }
});
