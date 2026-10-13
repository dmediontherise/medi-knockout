import { SpriteData } from './types';

// Palette mappings for DJ TITO
// Character traits: Dark beard, headphones, black polo, black pants, gold watch/chain
// NES Colors:
// 0x0F: Black outline & polo/pants (0x0F)
// 0x00: Dark gray shading (0x00)
// 0x10: Light gray headphones band (0x10)
// 0x20: White headphones pad / eyes (0x20)
// 0x28: Gold chain / watch (0x28)
// 0x17: Skin tone shadow (0x17)
// 0x27: Warm skin tone (0x27)
// 0x37: Light skin highlight (0x37)
// 0x16: Red headphone accent (0x16)
// Total colors: 9 distinct NES colors (< 12)
const DJ_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black
  'G': 0x00, // Dark gray
  'A': 0x10, // Light gray
  'W': 0x20, // White
  'Y': 0x28, // Gold
  'K': 0x17, // Dark skin
  'S': 0x27, // Skin
  'L': 0x37, // Light skin
  'R': 0x16, // Red
};

function buildDjRows(options: {
  headY?: number;
  headX?: number;
  leftArmPose?: 'guard' | 'punch' | 'tell' | 'block' | 'down';
  rightArmPose?: 'guard' | 'punch' | 'tell' | 'block' | 'down';
}): string[] {
  const width = 48;
  const height = 96;
  const rows: string[] = [];

  const headY = options.headY ?? 6;
  const headX = options.headX ?? 14;
  const lPose = options.leftArmPose ?? 'guard';
  const rPose = options.rightArmPose ?? 'guard';

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');

    // --- HEADPHONES & HEAD & BEARD (y from headY to headY + 24) ---
    if (y >= headY && y < headY + 24) {
      const relY = y - headY;
      const hWidth = relY < 4 ? 14 : relY < 18 ? 20 : 16;
      const left = headX + (20 - hWidth) / 2;
      const right = left + hWidth;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 0 || relY === 23) {
          rowChars[x] = 'B';
        } else if (relY < 4) {
          // Top headband of headphones
          rowChars[x] = (x >= left + 4 && x <= right - 5) ? 'A' : 'B';
        } else if (relY >= 4 && relY < 12) {
          // Headphones ear pads on sides, hair in middle
          if (x <= left + 2 || x >= right - 3) {
            rowChars[x] = 'R'; // Red ear cups
          } else if (relY < 7) {
            rowChars[x] = 'B'; // Dark hair
          } else {
            // Forehead
            rowChars[x] = (x < left + 8) ? 'L' : 'S';
          }
        } else if (relY >= 12 && relY < 17) {
          // Eyes & nose, ear pads
          if (x <= left + 2 || x >= right - 3) {
            rowChars[x] = 'R'; // Red ear cups
          } else if (relY === 13 && (x === left + 5 || x === right - 6)) {
            rowChars[x] = 'W'; // Eye
          } else if (relY === 13 && (x === left + 6 || x === right - 7)) {
            rowChars[x] = 'B'; // Pupil
          } else {
            rowChars[x] = 'S';
          }
        } else {
          // Full dark beard (y >= 17)
          rowChars[x] = 'B';
        }
      }
    }

    // --- TORSO / BLACK POLO & GOLD CHAIN (y from 30 to 64) ---
    if (y >= 30 && y < 64) {
      const relY = y - 30;
      const tWidth = relY < 12 ? 28 : relY < 24 ? 26 : 22;
      const left = 24 - tWidth / 2;
      const right = 24 + tWidth / 2;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 33) {
          rowChars[x] = 'B';
        } else if (relY >= 4 && relY <= 14 && (x === 23 || x === 24 || (relY === 14 && (x >= 21 && x <= 26)))) {
          // Gold chain necklace
          rowChars[x] = 'Y';
        } else {
          // Black polo with dark gray fabric shading
          rowChars[x] = (x < 18) ? 'G' : 'B';
        }
      }
    }

    // --- PANTS (y from 64 to 96) - Black pants ---
    if (y >= 64 && y < 96) {
      const relY = y - 64;
      const left = 14;
      const right = 34;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || (relY > 8 && (x === 23 || x === 24))) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x < 24) ? 'G' : 'B';
        }
      }
    }

    // --- LEFT ARM / GLOVE ---
    if (lPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 6; x < 16; x++) {
          rowChars[x] = (y > 44 && x > 9) ? 'R' : (x === 6 || y === 36) ? 'B' : 'K';
        }
      }
    } else if (lPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 14; x < 32; x++) {
          rowChars[x] = (x > 24) ? 'R' : 'S';
        }
      }
    } else if (lPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 2; x < 12; x++) {
          rowChars[x] = (y < 34) ? 'R' : 'S';
        }
      }
    } else if (lPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 12; x < 22; x++) {
          rowChars[x] = 'R';
        }
      }
    }

    // --- RIGHT ARM / GLOVE ---
    if (rPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 32; x < 42; x++) {
          // Gold watch on wrist
          if (y >= 42 && y <= 45 && x >= 34 && x <= 37) {
            rowChars[x] = 'Y';
          } else {
            rowChars[x] = (y > 44 && x < 39) ? 'R' : (x === 41 || y === 36) ? 'B' : 'K';
          }
        }
      }
    } else if (rPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'R' : 'S';
        }
      }
    } else if (rPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 36; x < 46; x++) {
          rowChars[x] = (y < 34) ? 'R' : 'S';
        }
      }
    } else if (rPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 26; x < 36; x++) {
          rowChars[x] = 'R';
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export const DJ_TITO_SPRITES: Record<string, SpriteData> = {
  IDLE_1: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 6 }),
  },
  IDLE_2: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 7 }),
  },
  BLOCK_HIGH: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ leftArmPose: 'block', rightArmPose: 'block' }),
  },
  BLOCK_LOW: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ leftArmPose: 'guard', rightArmPose: 'guard' }),
  },
  TELL_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ leftArmPose: 'tell' }),
  },
  TELL_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ rightArmPose: 'tell' }),
  },
  PUNCH_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ leftArmPose: 'punch' }),
  },
  PUNCH_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ rightArmPose: 'punch' }),
  },
  TELL_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 12, leftArmPose: 'tell' }),
  },
  TELL_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 16, rightArmPose: 'tell' }),
  },
  PUNCH_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 18, leftArmPose: 'punch' }),
  },
  PUNCH_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 10, rightArmPose: 'punch' }),
  },
  TELL_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 10, leftArmPose: 'guard' }),
  },
  TELL_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 10, rightArmPose: 'guard' }),
  },
  PUNCH_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 4, leftArmPose: 'block' }),
  },
  PUNCH_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 4, rightArmPose: 'block' }),
  },
  HIT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 18, headY: 4 }),
  },
  STUNNED: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headX: 10, headY: 8 }),
  },
  KNOCKED_DOWN: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 28 }),
  },
  KO: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ headY: 36 }),
  },
  TAUNT: {
    width: 48,
    height: 96,
    palette: DJ_PALETTE,
    rows: buildDjRows({ leftArmPose: 'block', rightArmPose: 'guard' }),
  },
};
