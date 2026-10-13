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
});
