import { SpriteData } from './types';
import { IDLE_BASE_PLAYER } from './generated/player';

// Player palette derived from the player's idle sprite colors
// NES Colors for Normal:
// 0x0F: Black outline & hair & trunks
// 0x07: Dark skin tone shadow
// 0x17: Skin tone
// 0x27: Medium skin tone
// 0x20: White waistband
// 0x16: Red gloves
// 0x26: Bright red glove highlight
// 0x00: Dark gray shading
const PLAYER_NORMAL_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black hair / trunks / outline
  'K': 0x07, // Dark skin shadow
  'S': 0x17, // Skin
  'L': 0x27, // Skin highlight
  'W': 0x20, // White waistband
  'R': 0x16, // Red gloves
  'H': 0x26, // Bright red
  'G': 0x00, // Dark gray shading
};

// NES Colors for Exhausted (Pink palette swap per spec requirement 6):
const PLAYER_EXHAUSTED_PALETTE: Record<string, number> = {
  '.': -1,
  'B': 0x0F, // Black hair / trunks / outline
  'K': 0x15, // Dark rose shadow
  'S': 0x25, // Pink skin (0x25)
  'L': 0x35, // Light pink highlight
  'W': 0x20, // White waistband
  'R': 0x25, // Pink gloves
  'H': 0x35, // Light pink
  'G': 0x15, // Dark rose shading
};

export function buildPlayerBackRows(options: {
  armLeft?: 'guard' | 'punch' | 'block' | 'down';
  armRight?: 'guard' | 'punch' | 'block' | 'down';
  bodyShiftX?: number;
  bodyShiftY?: number;
  duck?: boolean;
}): string[] {
  const width = 48; // >= 40px wide
  const height = 72; // 60-90px tall
  const rows: string[] = [];

  const shiftX = options.bodyShiftX ?? 0;
  const shiftY = (options.bodyShiftY ?? 0) + (options.duck ? 12 : 0);
  const lArm = options.armLeft ?? 'guard';
  const rArm = options.armRight ?? 'guard';

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');
    const effY = y - shiftY;

    if (effY >= 0 && effY < height) {
      // --- BACK OF HEAD (hair color, no face visible) (effY from 4 to 20) ---
      // Width: 20px (x from 14 to 34)
      if (effY >= 4 && effY < 20) {
        const left = 14 + shiftX;
        const right = 34 + shiftX;
        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            rowChars[x] = 'B';
          }
        }
      }

      // --- SHOULDERS AND BACK (effY from 20 to 48) ---
      // Width: 34px (x from 7 to 41)
      if (effY >= 20 && effY < 48) {
        const left = 7 + shiftX;
        const right = 41 + shiftX;
        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (x === left || x === right - 1) {
              rowChars[x] = 'B'; // Outline
            } else {
              rowChars[x] = (x < 24 + shiftX) ? 'S' : 'K';
            }
          }
        }
      }

      // --- BLACK TRUNKS (effY from 48 to 70) ---
      // Width: 30px (x from 9 to 39)
      if (effY >= 48 && effY < 70) {
        const left = 9 + shiftX;
        const right = 39 + shiftX;
        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (effY < 52) {
              rowChars[x] = 'W'; // White waistband
            } else if (x === left || x === right - 1 || (effY > 64 && (x === 23 + shiftX || x === 24 + shiftX))) {
              rowChars[x] = 'B'; // Outline / split
            } else {
              rowChars[x] = 'B'; // Black trunks
            }
          }
        }
      }

      // --- LEFT ARM / GLOVE (visible on left of body) ---
      if (lArm === 'guard') {
        if (effY >= 22 && effY < 38) {
          const gx = 2 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 32) ? 'R' : 'S';
            }
          }
        }
      } else if (lArm === 'punch') {
        if (effY >= 8 && effY < 30) {
          const gx = 12 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 18) ? 'H' : 'S';
            }
          }
        }
      } else if (lArm === 'block') {
        if (effY >= 14 && effY < 34) {
          const gx = 8 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = 'R';
            }
          }
        }
      }

      // --- RIGHT ARM / GLOVE (visible on right of body) ---
      if (rArm === 'guard') {
        if (effY >= 22 && effY < 38) {
          const gx = 38 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 32) ? 'R' : 'S';
            }
          }
        }
      } else if (rArm === 'punch') {
        if (effY >= 8 && effY < 30) {
          const gx = 28 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 18) ? 'H' : 'S';
            }
          }
        }
      } else if (rArm === 'block') {
        if (effY >= 14 && effY < 34) {
          const gx = 32 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
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
      rows = buildPlayerBackRows({});
      break;
    case 'DODGE_LEFT':
      rows = buildPlayerBackRows({ bodyShiftX: -2 });
      break;
    case 'DODGE_RIGHT':
      rows = buildPlayerBackRows({ bodyShiftX: 2 });
      break;
    case 'DUCK':
      rows = buildPlayerBackRows({ duck: true });
      break;
    case 'BLOCK':
      rows = buildPlayerBackRows({ armLeft: 'block', armRight: 'block' });
      break;
    case 'JAB_LEFT':
    case 'PUNCH_LEFT_HEAD':
    case 'PUNCH_LEFT_BODY':
      rows = buildPlayerBackRows({ armLeft: 'punch' });
      break;
    case 'JAB_RIGHT':
    case 'PUNCH_RIGHT_HEAD':
    case 'PUNCH_RIGHT_BODY':
      rows = buildPlayerBackRows({ armRight: 'punch' });
      break;
    case 'HOOK_LEFT':
      rows = buildPlayerBackRows({ armLeft: 'punch', bodyShiftX: -1 });
      break;
    case 'HOOK_RIGHT':
      rows = buildPlayerBackRows({ armRight: 'punch', bodyShiftX: 1 });
      break;
    case 'UPPERCUT':
    case 'STAR_PUNCH':
      rows = buildPlayerBackRows({ armRight: 'punch', bodyShiftY: -4 });
      break;
    case 'HIT':
      rows = buildPlayerBackRows({ bodyShiftX: 2, bodyShiftY: 3 });
      break;
    case 'KNOCKED_DOWN':
    case 'KO':
      rows = buildPlayerBackRows({ bodyShiftY: 22 });
      break;
    default:
      rows = buildPlayerBackRows({});
  }

  return {
    width: 48,
    height: 72,
    palette,
    rows,
  };
}
