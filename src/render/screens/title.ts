import { nesToRgba } from '../nesPalette';
import { drawBitmapText, drawBitmapText2x } from '../sprites/font';
import { PLAYER_IDLE_A, PLAYER_IDLE_A_ANCHOR_X } from '../sprites/generated/player';
import { blitSprite, CANVAS_WIDTH, CANVAS_HEIGHT } from '../sprites/blit';

export function renderTitleScreen(
  ctx: CanvasRenderingContext2D,
  frame: number
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;

  // 1. Fill background with deep NES navy/blue (0x02) or black (0x0F)
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

  // 2. Decorative borders (NES gold 0x28 and red 0x16)
  for (let x = 8; x < CANVAS_WIDTH - 8; x++) {
    setPixel(x, 8, 0x28);
    setPixel(x, 10, 0x16);
    setPixel(x, CANVAS_HEIGHT - 11, 0x16);
    setPixel(x, CANVAS_HEIGHT - 9, 0x28);
  }
  for (let y = 8; y < CANVAS_HEIGHT - 8; y++) {
    setPixel(8, y, 0x28);
    setPixel(10, y, 0x16);
    setPixel(CANVAS_WIDTH - 11, y, 0x16);
    setPixel(CANVAS_WIDTH - 9, y, 0x28);
  }

  // 3. Logo: "MEDI KNOCKOUT!!" drawn at 2x
  // "MEDI" centered at 2x: 4 chars * 16 = 64px width -> startX = (256 - 64)/2 = 96
  // "KNOCKOUT!!" centered at 2x: 10 chars * 16 = 160px width -> startX = (256 - 160)/2 = 48
  const logoLine1 = 'MEDI';
  const logoLine2 = 'KNOCKOUT!!';

  // Shadow first
  drawBitmapText2x(setPixel, logoLine1, 98, 26, 0x0f);
  drawBitmapText2x(setPixel, logoLine2, 50, 46, 0x0f);

  // Logo text in bright NES Gold (0x28) and White (0x20)
  drawBitmapText2x(setPixel, logoLine1, 96, 24, 0x20);
  drawBitmapText2x(setPixel, logoLine2, 48, 44, 0x28);

  // Subtitle / credits
  drawBitmapText(setPixel, 'CHAMPIONSHIP BOXING', 52, 70, 0x30);
  drawBitmapText(setPixel, '© 2026 MEDI PRODUCTIONS', 36, 82, 0x10);

  // 4. Player back-view sprite: IDLE_A, centered horizontally with anchorX at 128
  const playerX = 128 - PLAYER_IDLE_A_ANCHOR_X;
  const playerY = 190 - (PLAYER_IDLE_A.height - 1);
  blitSprite(data, PLAYER_IDLE_A, playerX, playerY);

  // 5. Blinking "PRESS START" (30-frame window: on 30 frames, off 30 frames)
  const isBlinkOn = Math.floor(frame / 30) % 2 === 0;
  if (isBlinkOn) {
    // "PRESS START": 11 chars * 8 = 88px width. startX = (256 - 88)/2 = 84
    drawBitmapText(setPixel, 'PRESS START', 84, 192, 0x28);
  }

  // Hint at bottom
  drawBitmapText(setPixel, 'PRESS ENTER OR SPACE', 48, 212, 0x20);

  ctx.putImageData(imgData, 0, 0);
}
