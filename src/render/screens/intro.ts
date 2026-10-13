import { nesToRgba } from '../nesPalette';
import { drawBitmapText, drawBitmapText2x } from '../sprites/font';
import { blitSpriteCrop, CANVAS_WIDTH, CANVAS_HEIGHT } from '../sprites/blit';
import { OPPONENT_PRESENTATION } from './presentationData';

export function renderIntroScreen(
  ctx: CanvasRenderingContext2D,
  oppId: string,
  frame: number
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;

  // Background: NES black (0x0F)
  const [bgR, bgG, bgB] = nesToRgba(0x0F);
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

  const info = OPPONENT_PRESENTATION[oppId] || OPPONENT_PRESENTATION.aint_man;

  // Outer decorative border
  for (let x = 6; x < CANVAS_WIDTH - 6; x++) {
    setPixel(x, 6, 0x28);
    setPixel(x, CANVAS_HEIGHT - 7, 0x28);
  }
  for (let y = 6; y < CANVAS_HEIGHT - 6; y++) {
    setPixel(6, y, 0x28);
    setPixel(CANVAS_WIDTH - 7, y, 0x28);
  }

  // Large portrait on left side (scaled 1.5x or 1x bust crop)
  // 55x55 bust crop drawn at x: 16, y: 32 inside a frame
  const portX = 16;
  const portY = 24;
  const portW = 60;
  const portH = 64;

  // Portrait box border
  for (let px = portX; px < portX + portW; px++) {
    setPixel(px, portY, 0x20);
    setPixel(px, portY + portH - 1, 0x20);
  }
  for (let py = portY; py < portY + portH; py++) {
    setPixel(portX, py, 0x20);
    setPixel(portX + portW - 1, py, 0x20);
  }

  blitSpriteCrop(
    data,
    info.sprite,
    portX + 2,
    portY + 2,
    info.portraitCrop.x,
    info.portraitCrop.y,
    portW - 4,
    portH - 4,
    1
  );

  // Right column: VS banner and opponent details
  drawBitmapText2x(setPixel, 'VS', 136, 18, 0x16);
  drawBitmapText(setPixel, 'CHALLENGER:', 90, 42, 0x20);
  drawBitmapText2x(setPixel, info.name, 90, 54, 0x28);

  // Info card fields below
  const infoStartY = 100;
  drawBitmapText(setPixel, `FROM:   ${info.hometown}`, 20, infoStartY, 0x20);
  drawBitmapText(setPixel, `RECORD: ${info.record}`, 20, infoStartY + 14, 0x30);
  drawBitmapText(setPixel, `QUOTE:`, 20, infoStartY + 28, 0x28);
  drawBitmapText(setPixel, info.quote, 20, infoStartY + 40, 0x20);

  // Divider line
  for (let x = 20; x < CANVAS_WIDTH - 20; x++) {
    setPixel(x, 168, 0x16);
  }

  // VS MEDI
  drawBitmapText2x(setPixel, 'MEDI', 96, 178, 0x20);
  drawBitmapText(setPixel, 'DEFENDING CHAMPION', 56, 202, 0x30);

  // Blinking start prompt
  if (Math.floor(frame / 20) % 2 === 0) {
    drawBitmapText(setPixel, 'PRESS START', 84, 218, 0x28);
  }

  ctx.putImageData(imgData, 0, 0);
}
