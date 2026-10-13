import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
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
  'TAUNT',
];
const PLAYER_ACTIONS = [
  'IDLE',
  'DODGE_LEFT',
  'DODGE_RIGHT',
  'DUCK',
  'BLOCK',
  'JAB_LEFT',
  'JAB_RIGHT',
  'HOOK_LEFT',
  'HOOK_RIGHT',
  'UPPERCUT',
  'HIT',
  'KNOCKED_DOWN',
  'KO',
];

// Helper to check if [r, g, b] matches any color in the NES palette
function isNesRgb(r: number, g: number, b: number): boolean {
  return NES_PALETTE.some(([nr, ng, nb]) => nr === r && ng === g && nb === b);
}

// Helper to verify a PNG screenshot file only contains colors from the NES palette
function verifyPngNesPalette(filePath: string): void {
  const fileData = fs.readFileSync(filePath);
  const png = PNG.sync.read(fileData);

  // Collect invalid colors to report nicely if any
  const invalidColors = new Set<string>();

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      // Note: We only check pixels rendered on the canvas
      if (!isNesRgb(r, g, b)) {
        invalidColors.add(`rgb(${r},${g},${b}) at (${x},${y})`);
        if (invalidColors.size >= 5) break;
      }
    }
    if (invalidColors.size >= 5) break;
  }

  expect(Array.from(invalidColors), `Found non-NES palette pixels in ${filePath}`).toEqual([]);
}

test.describe('Pose Preview E2E Suite', () => {
  const resultsDir = path.resolve(process.cwd(), 'test-results/poses');

  test.beforeAll(() => {
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
  });

  // Generate at least 45 poses (e.g. 5 opponents x 9 representative actions = 45 tests)
  // Plus variations with player actions
  for (let i = 0; i < OPPONENT_IDS.length; i++) {
    const oppId = OPPONENT_IDS[i];
    // Select 10 distinct actions per opponent -> 50 total tests (>= 45)
    const selectedActions = OPPONENT_ACTIONS.slice(0, 10);

    for (let j = 0; j < selectedActions.length; j++) {
      const oppAction = selectedActions[j];
      const playerAction = PLAYER_ACTIONS[j % PLAYER_ACTIONS.length];
      const testName = `${oppId}-${oppAction}-${playerAction}`;

      test(`pose preview: ${testName}`, async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on('pageerror', (err) => pageErrors.push(err));

        const targetUrl = `./?pose=${oppId}&action=${oppAction}&player=${playerAction}`;
        await page.goto(targetUrl);

        // Wait for canvas to be present
        const canvas = page.locator('canvas.game-canvas');
        await expect(canvas).toBeVisible();

        // Small wait for canvas frame render
        await page.waitForTimeout(100);

        expect(pageErrors).toHaveLength(0);

        const screenshotPath = path.join(resultsDir, `${testName}.png`);
        // Screenshot specifically the canvas element to test pure NES pixel output
        await canvas.screenshot({ path: screenshotPath });

        // Assert 100% of canvas pixels belong to NES palette
        verifyPngNesPalette(screenshotPath);
      });
    }
  }
});
