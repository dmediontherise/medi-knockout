import { SpriteData } from './types';

// Palette mappings for MR YANKEE
// Character traits: Oversized baseball head, navy cap with NY logo, navy-pinstripe uniform, navy socks
// NES Colors:
// 0x0F: Black outline (0x0F)
// 0x02: Navy blue cap / pinstripes / socks (0x02)
// 0x12: Medium navy blue shading (0x12)
// 0x20: White uniform / baseball head base / NY logo (0x20)
// 0x10: Light gray jersey shading (0x10)
// 0x16: Red baseball stitching seams (0x16)
// 0x27: Skin tone hands/neck (0x27)
// 0x17: Dark skin tone (0x17)
// Total colors: 8 distinct NES colors (< 12)
const YANKEE_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black outline
  'N': 0x02, // Navy blue
  'U': 0x12, // Medium navy
  'W': 0x20, // White base
  'A': 0x10, // Light gray
  'R': 0x16, // Red stitching
  'S': 0x27, // Skin tone
  'K': 0x17, // Skin shadow
};

function buildYankeeRows(options: {
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

    // --- OVERSIZED BASEBALL HEAD WITH CAP (y from headY to headY + 24) ---
    if (y >= headY && y < headY + 24) {
      const relY = y - headY;
      // Head is rounder and slightly wider (baseball mascot style)
      const hWidth = relY < 3 ? 16 : relY < 8 ? 22 : relY < 20 ? 24 : 18;
      const left = headX + (20 - hWidth) / 2;
      const right = left + hWidth;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 0 || relY === 23) {
          rowChars[x] = 'B';
        } else if (relY < 6) {
          // Navy cap with white NY emblem in center
          if (relY >= 2 && relY <= 5 && x >= left + 9 && x <= left + 12) {
            rowChars[x] = 'W'; // NY Logo
          } else {
            rowChars[x] = 'N'; // Navy cap
          }
        } else if (relY === 6) {
          // Cap brim
          rowChars[x] = 'N';
        } else if (relY > 6 && relY < 20) {
          // Baseball head with red seams and eyes
          const seamOffset = Math.abs(relY - 13);
          const leftSeam = left + 4 + Math.floor(seamOffset / 2);
          const rightSeam = right - 5 - Math.floor(seamOffset / 2);

          if (x === leftSeam || x === rightSeam) {
            rowChars[x] = 'R'; // Red baseball stitching
          } else if (relY === 12 && (x === left + 7 || x === right - 8)) {
            rowChars[x] = 'B'; // Eye pupil (two eyes visible)
          } else if (relY === 13 && (x === left + 7 || x === right - 8)) {
            rowChars[x] = 'B';
          } else {
            rowChars[x] = (x < left + 6) ? 'W' : (x > right - 6) ? 'A' : 'W';
          }
        } else {
          // Neck
          rowChars[x] = (x >= 21 && x <= 26) ? 'S' : 'B';
        }
      }
    }

    // --- PINSTRIPE JERSEY (y from 30 to 64) ---
    if (y >= 30 && y < 64) {
      const relY = y - 30;
      const tWidth = relY < 12 ? 28 : relY < 24 ? 26 : 22;
      const left = 24 - tWidth / 2;
      const right = 24 + tWidth / 2;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 33) {
          rowChars[x] = 'B';
        } else if (x % 4 === 0) {
          // Vertical navy pinstripes
          rowChars[x] = 'N';
        } else {
          rowChars[x] = (x < 18) ? 'W' : (x > 30) ? 'A' : 'W';
        }
      }
    }

    // --- PINSTRIPE PANTS & NAVY SOCKS (y from 64 to 96) ---
    if (y >= 64 && y < 96) {
      const relY = y - 64;
      const left = 14;
      const right = 34;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || (relY > 8 && (x === 23 || x === 24))) {
          rowChars[x] = 'B';
        } else if (relY > 20) {
          // Navy socks
          rowChars[x] = 'N';
        } else if (x % 4 === 0) {
          // Navy pinstripes
          rowChars[x] = 'N';
        } else {
          rowChars[x] = (x < 24) ? 'W' : 'A';
        }
      }
    }

    // --- LEFT ARM / NAVY GLOVE ---
    if (lPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 6; x < 16; x++) {
          rowChars[x] = (y > 44 && x > 9) ? 'N' : (x === 6 || y === 36) ? 'B' : 'W';
        }
      }
    } else if (lPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 14; x < 32; x++) {
          rowChars[x] = (x > 24) ? 'N' : 'W';
        }
      }
    } else if (lPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 2; x < 12; x++) {
          rowChars[x] = (y < 34) ? 'N' : 'W';
        }
      }
    } else if (lPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 12; x < 22; x++) {
          rowChars[x] = 'N';
        }
      }
    }

    // --- RIGHT ARM / NAVY GLOVE ---
    if (rPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 32; x < 42; x++) {
          rowChars[x] = (y > 44 && x < 39) ? 'N' : (x === 41 || y === 36) ? 'B' : 'W';
        }
      }
    } else if (rPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'N' : 'W';
        }
      }
    } else if (rPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 36; x < 46; x++) {
          rowChars[x] = (y < 34) ? 'N' : 'W';
        }
      }
    } else if (rPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 26; x < 36; x++) {
          rowChars[x] = 'N';
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export const MR_YANKEE_SPRITES: Record<string, SpriteData> = {
  IDLE_1: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 6 }),
  },
  IDLE_2: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 7 }),
  },
  BLOCK_HIGH: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ leftArmPose: 'block', rightArmPose: 'block' }),
  },
  BLOCK_LOW: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ leftArmPose: 'guard', rightArmPose: 'guard' }),
  },
  TELL_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ leftArmPose: 'tell' }),
  },
  TELL_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ rightArmPose: 'tell' }),
  },
  PUNCH_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ leftArmPose: 'punch' }),
  },
  PUNCH_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ rightArmPose: 'punch' }),
  },
  TELL_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 12, leftArmPose: 'tell' }),
  },
  TELL_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 16, rightArmPose: 'tell' }),
  },
  PUNCH_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 18, leftArmPose: 'punch' }),
  },
  PUNCH_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 10, rightArmPose: 'punch' }),
  },
  TELL_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 10, leftArmPose: 'guard' }),
  },
  TELL_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 10, rightArmPose: 'guard' }),
  },
  PUNCH_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 4, leftArmPose: 'block' }),
  },
  PUNCH_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 4, rightArmPose: 'block' }),
  },
  HIT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 18, headY: 4 }),
  },
  STUNNED: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headX: 10, headY: 8 }),
  },
  KNOCKED_DOWN: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 28 }),
  },
  KO: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ headY: 36 }),
  },
  TAUNT: {
    width: 48,
    height: 96,
    palette: YANKEE_PALETTE,
    rows: buildYankeeRows({ leftArmPose: 'block', rightArmPose: 'guard' }),
  },
};
