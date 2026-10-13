import { SpriteData } from './types';
import { PLAYER_BACK_IDLE } from './playerBack';
import { toFlashPalette, toDarkPalette } from '../nesPalette';

export { PLAYER_BACK_IDLE };

// Exhausted pink palette mapping: S, K, L mapped to pink entries (0x25, 0x15, 0x35)
export function getExhaustedPlayerPalette(basePalette: Record<string, number>): Record<string, number> {
  const pal = { ...basePalette };
  pal['S'] = 0x25; // Pink skin
  pal['K'] = 0x15; // Dark rose shadow
  pal['L'] = 0x35; // Light pink highlight
  pal['R'] = 0x25; // Pink gloves
  pal['H'] = 0x35;
  pal['G'] = 0x15;
  return pal;
}

// Generate transformed player sprite from PLAYER_BACK_IDLE
export function getPlayerSprite(action: string, isExhausted: boolean = false): SpriteData {
  let palette = isExhausted
    ? getExhaustedPlayerPalette(PLAYER_BACK_IDLE.palette)
    : { ...PLAYER_BACK_IDLE.palette };

  if (action === 'BLOCK') {
    const darkPal: Record<string, number> = {};
    for (const [k, v] of Object.entries(palette)) {
      darkPal[k] = (v as number) === -1 ? -1 : toDarkPalette(v as number);
    }
    palette = darkPal;
  }

  // Flash on star punch or hit
  if (action === 'STAR_PUNCH' || action === 'HIT') {
    const flashPal: Record<string, number> = {};
    for (const [k, v] of Object.entries(palette)) {
      flashPal[k] = (v as number) === -1 ? -1 : toFlashPalette(v as number);
    }
    palette = flashPal;
  }

  return {
    width: PLAYER_BACK_IDLE.width,
    height: PLAYER_BACK_IDLE.height,
    palette,
    rows: PLAYER_BACK_IDLE.rows,
  };
}
