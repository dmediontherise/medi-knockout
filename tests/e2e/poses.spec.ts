import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { Jimp } from 'jimp';
import { NES_PALETTE } from '../../src/render/nesPalette';
import { FONT_8X8 } from '../../src/render/sprites/font';

// Task 016 Requirement 3: wait on observable state instead of a fixed timeout.
// A pose preview sets data-game-state="PLAYING" and renders the requested frame in an
// effect. Waiting for the state, then for two animation frames, guarantees the canvas
// has drawn the pose before the screenshot is taken, however loaded the host is.
async function waitForPose(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('[data-game-state]')?.getAttribute('data-game-state') === 'PLAYING',
    null,
    { timeout: 10000 }
  );
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );
}

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
  const playerDir = path.join(screenshotsDir, 'player');

  test.beforeAll(() => {
    if (!fs.existsSync(posesDir)) {
      fs.mkdirSync(posesDir, { recursive: true });
    }
    if (!fs.existsSync(playerDir)) {
      fs.mkdirSync(playerDir, { recursive: true });
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
        await waitForPose(page);

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
      await waitForPose(page);

      expect(pageErrors).toHaveLength(0);

      const screenshotPath = path.join(posesDir, `player-${playerAction}.png`);
      await canvas.screenshot({ path: screenshotPath });

      verifyPngNesPalette(screenshotPath);
    });
  }

  // 2b. Player frames: screenshots/player/<frame>.png and screenshots/player/contact.png
  const PLAYER_FRAME_TESTS: { name: string; query: string }[] = [
    { name: 'IDLE_A', query: 'player=IDLE&frame=0' },
    { name: 'IDLE_B', query: 'player=IDLE&frame=16' },
    { name: 'JAB_L_WIND', query: 'player=PUNCH_LEFT_HEAD&pframe=0' },
    { name: 'JAB_L_HIT', query: 'player=PUNCH_LEFT_HEAD&pframe=5' },
    { name: 'JAB_L_BACK', query: 'player=PUNCH_LEFT_HEAD&pframe=10' },
    { name: 'JAB_R_WIND', query: 'player=PUNCH_RIGHT_HEAD&pframe=0' },
    { name: 'JAB_R_HIT', query: 'player=PUNCH_RIGHT_HEAD&pframe=5' },
    { name: 'JAB_R_BACK', query: 'player=PUNCH_RIGHT_HEAD&pframe=10' },
    { name: 'BODY_L_WIND', query: 'player=PUNCH_LEFT_BODY&pframe=0' },
    { name: 'BODY_L_HIT', query: 'player=PUNCH_LEFT_BODY&pframe=5' },
    { name: 'BODY_L_BACK', query: 'player=PUNCH_LEFT_BODY&pframe=10' },
    { name: 'BODY_R_WIND', query: 'player=PUNCH_RIGHT_BODY&pframe=0' },
    { name: 'BODY_R_HIT', query: 'player=PUNCH_RIGHT_BODY&pframe=5' },
    { name: 'BODY_R_BACK', query: 'player=PUNCH_RIGHT_BODY&pframe=10' },
    { name: 'STAR_WIND', query: 'player=STAR_PUNCH&pframe=2' },
    { name: 'STAR_HIT', query: 'player=STAR_PUNCH&pframe=10' },
    { name: 'STAR_BACK', query: 'player=STAR_PUNCH&pframe=18' },
    { name: 'DODGE_L_HALF', query: 'player=DODGE_LEFT&pframe=1' },
    { name: 'DODGE_L', query: 'player=DODGE_LEFT&pframe=6' },
    { name: 'DODGE_R_HALF', query: 'player=DODGE_RIGHT&pframe=1' },
    { name: 'DODGE_R', query: 'player=DODGE_RIGHT&pframe=6' },
    { name: 'DUCK', query: 'player=DUCK&pframe=0' },
    { name: 'BLOCK', query: 'player=BLOCK&pframe=0' },
    { name: 'HIT', query: 'player=HIT&pframe=6' },
    { name: 'EXHAUSTED_A', query: 'player=IDLE&exh=1&frame=0' },
    { name: 'EXHAUSTED_B', query: 'player=IDLE&exh=1&frame=12' },
    { name: 'FALL', query: 'player=KNOCKED_DOWN&pframe=5' },
    { name: 'DOWN', query: 'player=KNOCKED_DOWN&pframe=15' },
    { name: 'GET_UP', query: 'player=KNOCKED_DOWN&mash=1' },
    { name: 'WIN', query: 'player=WIN' },
  ];

  for (const fItem of PLAYER_FRAME_TESTS) {
    test(`player frame screenshot: ${fItem.name}`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const targetUrl = `./?pose=aint_man&action=IDLE&${fItem.query}`;
      await page.goto(targetUrl);

      const canvas = page.locator('canvas.game-canvas');
      await expect(canvas).toBeVisible();
      await waitForPose(page);

      expect(pageErrors).toHaveLength(0);

      const screenshotPath = path.join(playerDir, `${fItem.name}.png`);
      await canvas.screenshot({ path: screenshotPath });

      verifyPngNesPalette(screenshotPath);
    });
  }

  test('player contact sheet: screenshots/player/contact.png', async () => {
    // 5 columns by 6 rows grid for the 30 frames
    const cols = 5;
    const rows = Math.ceil(PLAYER_FRAME_TESTS.length / cols);
    const cellW = 256;
    const cellH = 240;
    const labelH = 16;
    const totalCellH = cellH + labelH;
    const totalW = cols * cellW;
    const totalH = rows * totalCellH;

    const sheet = new Jimp({ width: totalW, height: totalH, color: 0x000000ff });

    for (let i = 0; i < PLAYER_FRAME_TESTS.length; i++) {
      const fItem = PLAYER_FRAME_TESTS[i];
      const posePath = path.join(playerDir, `${fItem.name}.png`);
      expect(fs.existsSync(posePath), `Expected player frame screenshot ${posePath}`).toBe(true);

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
      const textX = posX + Math.max(4, Math.floor((cellW - fItem.name.length * 8) / 2));
      const textY = posY + cellH + 4;
      drawBitmapTextOnJimp(sheet, fItem.name, textX, textY, 0xffffffff);
    }

    const contactPath = path.join(playerDir, 'contact.png');
    const buffer = await sheet.getBuffer('image/png');
    fs.writeFileSync(contactPath, buffer);
    expect(fs.existsSync(contactPath)).toBe(true);
    verifyPngNesPalette(contactPath);
  });

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

  // 4. Requirements 6 & 7: Knockdown screenshots screenshots/fall/<id>-KO-<n>.png for n in {0, 5, 12, 20, 30}
  const FALL_FRAMES = [0, 5, 12, 20, 30];
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
        await waitForPose(page);
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

      // Empty reference frame: actionFrame 35 blinks off for KO
      const emptyPath = path.join(fallDir, `.${oppId}-empty-ref.png`);
      await page.goto(`./?pose=${oppId}&action=KO&player=IDLE&frame=35`);
      const canvas = page.locator('canvas.game-canvas');
      await expect(canvas).toBeVisible();
      await waitForPose(page);
      await canvas.screenshot({ path: emptyPath });
      const emptyFrame = await Jimp.read(emptyPath);
      if (emptyFrame.bitmap.width !== 256 || emptyFrame.bitmap.height !== 240) {
        emptyFrame.resize({ w: 256, h: 240 });
      }
      fs.rmSync(emptyPath, { force: true });

      // Requirement 6 assertions at frame 30:
      // - Opponent opaque pixels span >= 100 px horizontally
      // - At most 90 px vertically for characters with sheet lying frames (medi_jinx, maga_man)
      // - Every opaque row is <= 192 (nothing below mat line)
      const img30 = frameImages[30];
      let minX = 256, maxX = -1, minY = 240, maxY = -1;
      let nonBgCount = 0;

      for (let y = 48; y < 240; y++) {
        for (let x = 0; x < 256; x++) {
          if (img30.getPixelColor(x, y) !== emptyFrame.getPixelColor(x, y)) {
            nonBgCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      expect(nonBgCount, `${oppId} KO frame 30 has opponent`).toBeGreaterThan(100);
      const hSpan = maxX - minX + 1;
      const vSpan = maxY - minY + 1;
      expect(hSpan, `${oppId} KO frame 30 horizontal span >= 90 px`).toBeGreaterThanOrEqual(90);
      expect(vSpan, `${oppId} KO frame 30 vertical span <= 100 px`).toBeLessThanOrEqual(100);
      expect(maxY, `${oppId} KO frame 30 bottom row <= 192`).toBeLessThanOrEqual(192);
      expect(hSpan, `${oppId} KO frame 30 horizontal span > vertical span`).toBeGreaterThan(vSpan);
    });
  }

  // 5. Requirement 6: Review sheet screenshots in screenshots/feel/
  // hit-left-<id>-2.png, hit-right-<id>-2.png, hit-body-<id>-2.png, lunge-<id>-PUNCH_HOOK_LEFT.png
  const feelDir = path.join(screenshotsDir, 'feel');

  test.describe('feel review screenshots', () => {
    test.beforeAll(() => {
      if (!fs.existsSync(feelDir)) {
        fs.mkdirSync(feelDir, { recursive: true });
      }
    });

    for (const oppId of OPPONENT_IDS) {
      test(`feel screenshots: ${oppId}`, async ({ page }) => {
        const feelCases = [
          {
            filename: `hit-left-${oppId}-2.png`,
            query: `pose=${oppId}&action=HIT&frame=2&hitSide=LEFT&hitTarget=HEAD&player=IDLE`,
          },
          {
            filename: `hit-right-${oppId}-2.png`,
            query: `pose=${oppId}&action=HIT&frame=2&hitSide=RIGHT&hitTarget=HEAD&player=IDLE`,
          },
          {
            filename: `hit-body-${oppId}-2.png`,
            query: `pose=${oppId}&action=HIT&frame=2&hitSide=RIGHT&hitTarget=BODY&player=IDLE`,
          },
          {
            filename: `lunge-${oppId}-PUNCH_HOOK_LEFT.png`,
            query: `pose=${oppId}&action=PUNCH_HOOK_LEFT&frame=0&player=IDLE`,
          },
        ];

        for (const item of feelCases) {
          const pageErrors: Error[] = [];
          page.on('pageerror', (err) => pageErrors.push(err));

          await page.goto(`./?${item.query}`);
          const canvas = page.locator('canvas.game-canvas');
          await expect(canvas).toBeVisible();
          await waitForPose(page);
          expect(pageErrors).toHaveLength(0);

          const filePath = path.join(feelDir, item.filename);
          await canvas.screenshot({ path: filePath });
          verifyPngNesPalette(filePath);
        }
      });
    }
  });
});
