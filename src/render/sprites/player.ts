import { SpriteData } from './types';

// Palette mappings for PLAYER (seen from behind: black hair, dark skin, black trunks with white waistband, red gloves)
// Exhausted palette: pink palette swap (skin becomes pink/washed out, trunks become pinkish)
// NES Colors for Normal:
// 0x0F: Black outline & trunks & hair (0x0F)
// 0x07: Dark brown skin shadow (0x07)
// 0x17: Dark skin tone (0x17)
// 0x27: Medium skin tone (0x27)
// 0x20: White waistband (0x20)
// 0x16: Red gloves (0x16)
// 0x26: Bright red glove highlight (0x26)
// Total normal colors: 7 distinct NES colors (< 12)
const PLAYER_NORMAL_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black
  'K': 0x07, // Dark brown skin
  'S': 0x17, // Skin
  'L': 0x27, // Skin highlight
  'W': 0x20, // White waistband
  'R': 0x16, // Red gloves
  'H': 0x26, // Bright red
};

// NES Colors for Exhausted (Pink palette swap):
// 0x25: Pink / Rose skin (0x25)
// 0x35: Light pink highlight (0x35)
// 0x15: Dark rose shadow (0x15)
const PLAYER_EXHAUSTED_PALETTE: Record<string, number> = {
  '.': -1,
  'B': 0x0F, // Black hair / outlines
  'K': 0x15, // Dark rose shadow
  'S': 0x25, // Pink skin
  'L': 0x35, // Light pink highlight
  'W': 0x20, // White waistband
  'R': 0x25, // Pink gloves
  'H': 0x35, // Light pink
};

function buildPlayerRows(options: {
  armLeft?: 'guard' | 'punch' | 'block' | 'down';
  armRight?: 'guard' | 'punch' | 'block' | 'down';
  bodyShiftX?: number;
  bodyShiftY?: number;
  duck?: boolean;
}): string[] {
  const width = 36;
  const height = 54; // <= 60% of opponent's 96px (54 <= 57.6px)
  const rows: string[] = [];

  const shiftX = options.bodyShiftX ?? 0;
  const shiftY = (options.bodyShiftY ?? 0) + (options.duck ? 12 : 0);
  const lArm = options.armLeft ?? 'guard';
  const rArm = options.armRight ?? 'guard';

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');

    const effectiveY = y - shiftY;

    if (effectiveY >= 0 && effectiveY < height) {
      // --- BACK OF HEAD (effectiveY from 2 to 14) ---
      if (effectiveY >= 2 && effectiveY < 14) {
        const relY = effectiveY - 2;
        const hWidth = relY < 3 ? 10 : relY < 8 ? 14 : 10;
        const left = 18 + shiftX - Math.floor(hWidth / 2);
        const right = left + hWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            // Seen from behind: black hair covers back of head
            rowChars[x] = (relY === 0 || relY === 11 || x === left || x === right - 1) ? 'B' : 'B';
          }
        }
      }

      // --- NECK & SHOULDERS / BACK (effectiveY from 14 to 34) ---
      if (effectiveY >= 14 && effectiveY < 34) {
        const relY = effectiveY - 14;
        const bWidth = relY < 6 ? 16 : relY < 14 ? 18 : 14;
        const left = 18 + shiftX - Math.floor(bWidth / 2);
        const right = left + bWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (x === left || x === right - 1) {
              rowChars[x] = 'B';
            } else {
              // Muscle contours of back
              rowChars[x] = (x < 18 + shiftX) ? 'S' : 'K';
            }
          }
        }
      }

      // --- TRUNKS (effectiveY from 34 to 54) ---
      if (effectiveY >= 34 && effectiveY < 54) {
        const relY = effectiveY - 34;
        const tWidth = relY < 4 ? 16 : 14;
        const left = 18 + shiftX - Math.floor(tWidth / 2);
        const right = left + tWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (relY < 3) {
              rowChars[x] = 'W'; // White waistband
            } else if (x === left || x === right - 1 || (relY > 10 && x === 18 + shiftX)) {
              rowChars[x] = 'B';
            } else {
              rowChars[x] = 'B'; // Black trunks
            }
          }
        }
      }

      // --- LEFT ARM / GLOVE (seen from behind) ---
      if (lArm === 'guard') {
        if (effectiveY >= 14 && effectiveY < 30) {
          const gx = 8 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effectiveY < 22) ? 'R' : 'S';
            }
          }
        }
      } else if (lArm === 'punch') {
        if (effectiveY >= 4 && effectiveY < 24) {
          const gx = 12 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effectiveY < 12) ? 'H' : 'S';
            }
          }
        }
      } else if (lArm === 'block') {
        if (effectiveY >= 8 && effectiveY < 22) {
          const gx = 10 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = 'R';
            }
          }
        }
      }

      // --- RIGHT ARM / GLOVE (seen from behind) ---
      if (rArm === 'guard') {
        if (effectiveY >= 14 && effectiveY < 30) {
          const gx = 22 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effectiveY < 22) ? 'R' : 'S';
            }
          }
        }
      } else if (rArm === 'punch') {
        if (effectiveY >= 4 && effectiveY < 24) {
          const gx = 18 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effectiveY < 12) ? 'H' : 'S';
            }
          }
        }
      } else if (rArm === 'block') {
        if (effectiveY >= 8 && effectiveY < 22) {
          const gx = 20 + shiftX;
          for (let x = gx; x < gx + 6; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = 'R';
            }
          }
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export function getPlayerSprite(action: string, isExhausted: boolean = false): SpriteData {
  const palette = isExhausted ? PLAYER_EXHAUSTED_PALETTE : PLAYER_NORMAL_PALETTE;

  let rows: string[];
  switch (action) {
    case 'IDLE':
      rows = buildPlayerRows({});
      break;
    case 'DODGE_LEFT':
      rows = buildPlayerRows({ bodyShiftX: -2 }); // Note: screen offset handles full 24px, sprite leans 2px
      break;
    case 'DODGE_RIGHT':
      rows = buildPlayerRows({ bodyShiftX: 2 });
      break;
    case 'DUCK':
      rows = buildPlayerRows({ duck: true });
      break;
    case 'BLOCK':
      rows = buildPlayerRows({ armLeft: 'block', armRight: 'block' });
      break;
    case 'JAB_LEFT':
      rows = buildPlayerRows({ armLeft: 'punch' });
      break;
    case 'JAB_RIGHT':
      rows = buildPlayerRows({ armRight: 'punch' });
      break;
    case 'HOOK_LEFT':
      rows = buildPlayerRows({ armLeft: 'punch', bodyShiftX: -1 });
      break;
    case 'HOOK_RIGHT':
      rows = buildPlayerRows({ armRight: 'punch', bodyShiftX: 1 });
      break;
    case 'UPPERCUT':
      rows = buildPlayerRows({ armRight: 'punch', bodyShiftY: -4 });
      break;
    case 'HIT':
      rows = buildPlayerRows({ bodyShiftX: 2, bodyShiftY: 3 });
      break;
    case 'KNOCKED_DOWN':
    case 'KO':
      rows = buildPlayerRows({ bodyShiftY: 18 });
      break;
    default:
      rows = buildPlayerRows({});
  }

  return {
    width: 36,
    height: 54,
    palette,
    rows,
  };
}
