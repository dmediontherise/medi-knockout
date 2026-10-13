import { nesToRgba } from '../nesPalette';
import { drawBitmapText, drawBitmapText2x } from '../sprites/font';
import { blitSpriteCrop, CANVAS_WIDTH, CANVAS_HEIGHT } from '../sprites/blit';
import { OPPONENT_PRESENTATION, CIRCUIT_ROSTER_IDS } from './presentationData';

export function isOpponentUnlocked(
  oppId: string,
  unlockedIndex: number,
  unlockAll: boolean
): boolean {
  if (unlockAll) return true;
  const idx = CIRCUIT_ROSTER_IDS.indexOf(oppId);
  if (idx < 0) return false;
  return idx <= unlockedIndex;
}

// Alias for probe compatibility
export const checkUnlocked = isOpponentUnlocked;

export function renderCircuitScreen(
  ctx: CanvasRenderingContext2D,
  selectedIndex: number,
  unlockedIndex: number,
  unlockAll: boolean,
  frame: number
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;

  // Background: NES dark navy (0x02)
  const [bgR, bgG, bgB] = nesToRgba(0x02);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgR;
    data[i + 1] = bgG;
    data[i + 2] = bgB;
    data[i + 3] = 255;
  }

  const setPixel = (x: number, y: number, nesColor: number) => {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
    const [r, g, b] = nesToRgba(nesColor);
    const idx = (y * CANVAS_WIDTH + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  // Header
  drawBitmapText(setPixel, 'WVBA CIRCUIT SELECT', 52, 10, 0x28);
  for (let x = 16; x < CANVAS_WIDTH - 16; x++) {
    setPixel(x, 22, 0x20);
  }

  // Draw 5 opponents
  // Each row takes ~36px height (y starts at 30)
  for (let i = 0; i < CIRCUIT_ROSTER_IDS.length; i++) {
    const oppId = CIRCUIT_ROSTER_IDS[i];
    const info = OPPONENT_PRESENTATION[oppId];
    const rowY = 30 + i * 38;
    const isUnlocked = isOpponentUnlocked(oppId, unlockedIndex, unlockAll);
    const isSelected = i === selectedIndex;

    // Selection cursor arrow "►" or blinking box
    if (isSelected) {
      // Draw cursor arrow or cursor star
      drawBitmapText(setPixel, '>', 8, rowY + 12, 0x28);

      // Selection box outline
      const boxColor = Math.floor(frame / 15) % 2 === 0 ? 0x28 : 0x20;
      for (let bx = 20; bx < CANVAS_WIDTH - 12; bx++) {
        setPixel(bx, rowY - 2, boxColor);
        setPixel(bx, rowY + 34, boxColor);
      }
      for (let by = rowY - 2; by <= rowY + 34; by++) {
        setPixel(20, by, boxColor);
        setPixel(CANVAS_WIDTH - 12, by, boxColor);
      }
    }

    // Portrait box (32x32) at x: 24, y: rowY
    const pX = 24;
    const pY = rowY;
    // Portrait frame outline
    for (let px = pX; px < pX + 34; px++) {
      setPixel(px, pY, 0x20);
      setPixel(px, pY + 33, 0x20);
    }
    for (let py = pY; py <= pY + 33; py++) {
      setPixel(pX, py, 0x20);
      setPixel(pX + 33, py, 0x20);
    }

    if (isUnlocked && info) {
      // Blit cropped portrait (32x32 from bust crop)
      blitSpriteCrop(
        data,
        info.sprite,
        pX + 1,
        pY + 1,
        info.portraitCrop.x,
        info.portraitCrop.y,
        32,
        32,
        1
      );

      // Name & Record
      const nameColor = isSelected ? 0x28 : 0x20;
      drawBitmapText(setPixel, info.name, 64, rowY + 6, nameColor);
      drawBitmapText(setPixel, `RECORD: ${info.record}`, 64, rowY + 18, 0x30);
    } else {
      // Locked: display "???"
      drawBitmapText(setPixel, '???', pX + 6, pY + 12, 0x10);
      drawBitmapText(setPixel, 'CHALLENGER ???', 64, rowY + 6, 0x10);
      drawBitmapText(setPixel, 'RECORD: ???', 64, rowY + 18, 0x10);
    }
  }

  // Footer instructions
  drawBitmapText(setPixel, 'UP/DOWN: SELECT   START/A: FIGHT', 16, 224, 0x20);

  ctx.putImageData(imgData, 0, 0);
}
