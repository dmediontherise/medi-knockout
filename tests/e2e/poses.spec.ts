import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { Jimp } from 'jimp';
import { NES_PALETTE } from '../../src/render/nesPalette';

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
      // Create contact sheet grid: e.g. 5 columns by 4 rows (20 slots for 19 actions)
      const cols = 5;
      const rows = Math.ceil(OPPONENT_ACTIONS.length / cols);
      const cellW = 256;
      const cellH = 240;
      const totalW = cols * cellW;
      const totalH = rows * cellH;

      const sheet = new Jimp({ width: totalW, height: totalH, color: 0x0f172aff });

      for (let i = 0; i < OPPONENT_ACTIONS.length; i++) {
        const action = OPPONENT_ACTIONS[i];
        const posePath = path.join(posesDir, `${oppId}-${action}.png`);
        expect(fs.existsSync(posePath), `Expected pose screenshot ${posePath}`).toBe(true);

        const frameImg = await Jimp.read(posePath);
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const posX = colIdx * cellW;
        const posY = rowIdx * cellH;

        sheet.composite(frameImg, posX, posY);
      }

      const contactPath = path.join(screenshotsDir, `contact-${oppId}.png`);
      const buffer = await sheet.getBuffer('image/png');
      fs.writeFileSync(contactPath, buffer);
      expect(fs.existsSync(contactPath)).toBe(true);
    });
  }
});
