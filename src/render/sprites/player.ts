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

function buildPlayerBackRows(options: {
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
      if (effY >= 4 && effY < 20) {
        const relY = effY - 4;
        const hWidth = relY < 4 ? 14 : relY < 12 ? 18 : 14;
        const left = 24 + shiftX - Math.floor(hWidth / 2);
        const right = left + hWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            // Seen from behind: black hair covers back of head
            rowChars[x] = (x === left || x === right - 1 || relY === 0 || relY === 15) ? 'B' : 'B';
          }
        }
      }

      // --- SHOULDERS AND BACK (effY from 20 to 48) ---
      if (effY >= 20 && effY < 48) {
        const relY = effY - 20;
        const bWidth = relY < 8 ? 22 : relY < 18 ? 24 : 20;
        const left = 24 + shiftX - Math.floor(bWidth / 2);
        const right = left + bWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (x === left || x === right - 1) {
              rowChars[x] = 'B';
            } else {
              // Muscular contours of back seen from behind
              rowChars[x] = (x < 24 + shiftX) ? 'S' : 'K';
            }
          }
        }
      }

      // --- BLACK TRUNKS (effY from 48 to 72) ---
      if (effY >= 48 && effY < 72) {
        const relY = effY - 48;
        const tWidth = relY < 5 ? 22 : 20;
        const left = 24 + shiftX - Math.floor(tWidth / 2);
        const right = left + tWidth;

        for (let x = left; x < right; x++) {
          if (x >= 0 && x < width) {
            if (relY < 4) {
              rowChars[x] = 'W'; // White waistband
            } else if (x === left || x === right - 1 || (relY > 14 && (x === 23 + shiftX || x === 24 + shiftX))) {
              rowChars[x] = 'B';
            } else {
              rowChars[x] = 'B'; // Black trunks
            }
          }
        }
      }

      // --- LEFT ARM / GLOVE (visible on left of body) ---
      if (lArm === 'guard') {
        if (effY >= 20 && effY < 42) {
          const gx = 10 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 32) ? 'R' : 'S';
            }
          }
        }
      } else if (lArm === 'punch') {
        if (effY >= 6 && effY < 32) {
          const gx = 16 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 18) ? 'H' : 'S';
            }
          }
        }
      } else if (lArm === 'block') {
        if (effY >= 12 && effY < 32) {
          const gx = 14 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = 'R';
            }
          }
        }
      }

      // --- RIGHT ARM / GLOVE (visible on right of body) ---
      if (rArm === 'guard') {
        if (effY >= 20 && effY < 42) {
          const gx = 30 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 32) ? 'R' : 'S';
            }
          }
        }
      } else if (rArm === 'punch') {
        if (effY >= 6 && effY < 32) {
          const gx = 24 + shiftX;
          for (let x = gx; x < gx + 8; x++) {
            if (x >= 0 && x < width) {
              rowChars[x] = (effY < 18) ? 'H' : 'S';
            }
          }
        }
      } else if (rArm === 'block') {
        if (effY >= 12 && effY < 32) {
          const gx = 26 + shiftX;
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
