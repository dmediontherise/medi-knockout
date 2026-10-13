import { SpriteData } from '../types';
import { nesToRgba } from '../nesPalette';

export const CANVAS_WIDTH = 256;
export const CANVAS_HEIGHT = 240;

export function blitSprite(
  data: Uint8ClampedArray,
  sprite: SpriteData,
  destX: number,
  destY: number,
  overrideColor?: number,
  clipMaxY?: number
) {
  for (let sy = 0; sy < sprite.height; sy++) {
    const py = destY + sy;
    if (py < 0 || py >= CANVAS_HEIGHT) continue;
    if (clipMaxY !== undefined && py >= clipMaxY) continue;
    const row = sprite.rows[sy];
    if (!row) continue;

    for (let sx = 0; sx < sprite.width; sx++) {
      const px = destX + sx;
      if (px < 0 || px >= CANVAS_WIDTH) continue;

      const char = row[sx];
      if (char === '.' || char === ' ') continue;

      const nesColor = (overrideColor !== undefined) ? overrideColor : (sprite.palette[char] ?? -1);
      if (nesColor < 0) continue;

      const [r, g, b] = nesToRgba(nesColor);
      const idx = (py * CANVAS_WIDTH + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}

// Blit a sub-rectangle of a sprite (e.g. crop head/bust for a portrait)
// optionally at 1x or 2x integer scale
export function blitSpriteCrop(
  data: Uint8ClampedArray,
  sprite: SpriteData,
  destX: number,
  destY: number,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  scale: number = 1
) {
  for (let sy = 0; sy < srcH; sy++) {
    const rowY = srcY + sy;
    if (rowY < 0 || rowY >= sprite.height) continue;
    const row = sprite.rows[rowY];
    if (!row) continue;

    for (let sx = 0; sx < srcW; sx++) {
      const colX = srcX + sx;
      if (colX < 0 || colX >= sprite.width) continue;

      const char = row[colX];
      if (char === '.' || char === ' ') continue;

      const nesColor = sprite.palette[char] ?? -1;
      if (nesColor < 0) continue;

      const [r, g, b] = nesToRgba(nesColor);

      for (let dy = 0; dy < scale; dy++) {
        const py = destY + sy * scale + dy;
        if (py < 0 || py >= CANVAS_HEIGHT) continue;

        for (let dx = 0; dx < scale; dx++) {
          const px = destX + sx * scale + dx;
          if (px < 0 || px >= CANVAS_WIDTH) continue;

          const idx = (py * CANVAS_WIDTH + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }
  }
}
