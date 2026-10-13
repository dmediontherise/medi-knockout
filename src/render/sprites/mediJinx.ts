import { SpriteData } from './types';

// Palette mappings for MEDI JINX
// Character traits: Blue skin, black beanie, red logo, red pants, white gloves
// NES Colors:
// 0x0F: Black outline (0x0F)
// 0x12: Dark blue skin shadow (0x12)
// 0x22: Medium blue skin (0x22)
// 0x31: Light blue skin highlight (0x31)
// 0x16: Red logo / pants (0x16)
// 0x26: Bright red highlight (0x26)
// 0x06: Dark red shadow (0x06)
// 0x00: Dark gray beanie / shading (0x00)
// 0x20: White gloves / logo white (0x20)
// 0x10: Light gray glove shading (0x10)
// Total colors: 10 distinct NES colors (< 12)
const MEDI_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black outline
  'u': 0x12, // Dark blue skin
  'U': 0x22, // Medium blue skin
  'L': 0x31, // Light blue highlight
  'r': 0x06, // Dark red
  'R': 0x16, // Red
  'H': 0x26, // Bright red
  'G': 0x00, // Dark gray (beanie)
  'W': 0x20, // White (gloves)
  'A': 0x10, // Light gray
};

function buildMediRows(options: {
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

    // --- BEANIE & HEAD (y from headY to headY + 24) ---
    if (y >= headY && y < headY + 24) {
      const relY = y - headY;
      const hWidth = relY < 4 ? 14 : relY < 18 ? 20 : 16;
      const left = headX + (20 - hWidth) / 2;
      const right = left + hWidth;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 0 || relY === 23) {
          rowChars[x] = 'B';
        } else if (relY < 10) {
          // Black Beanie with red logo in center
          if (relY >= 4 && relY <= 7 && x >= left + 8 && x <= left + 11) {
            rowChars[x] = 'R'; // Red logo
          } else {
            rowChars[x] = (x < left + 4) ? 'G' : 'B'; // Beanie fabric
          }
        } else if (relY >= 10 && relY < 18) {
          // Blue Face (both eyes visible)
          if (relY === 13 && (x === left + 5 || x === right - 6)) {
            rowChars[x] = 'W'; // Eye sclera
          } else if (relY === 13 && (x === left + 6 || x === right - 7)) {
            rowChars[x] = 'B'; // Eye pupil
          } else {
            rowChars[x] = (x < left + 4) ? 'L' : (x > right - 5) ? 'u' : 'U';
          }
        } else {
          // Chin & neck (blue)
          rowChars[x] = (relY === 22) ? 'B' : 'u';
        }
      }
    }

    // --- TORSO (y from 30 to 64) - Bare blue chest with athletic build ---
    if (y >= 30 && y < 64) {
      const relY = y - 30;
      const tWidth = relY < 12 ? 28 : relY < 24 ? 26 : 22;
      const left = 24 - tWidth / 2;
      const right = 24 + tWidth / 2;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 33) {
          rowChars[x] = 'B';
        } else {
          // Blue muscle shading
          rowChars[x] = (x < 16) ? 'L' : (x > 32) ? 'u' : 'U';
        }
      }
    }

    // --- RED PANTS / SHORTS (y from 64 to 96) ---
    if (y >= 64 && y < 96) {
      const relY = y - 64;
      const left = 14;
      const right = 34;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || (relY > 8 && (x === 23 || x === 24))) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x < 24) ? 'R' : 'r'; // Red shorts
        }
      }
    }

    // --- LEFT ARM / WHITE GLOVE ---
    if (lPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 6; x < 16; x++) {
          rowChars[x] = (y > 44 && x > 9) ? 'W' : (x === 6 || y === 36) ? 'B' : 'u';
        }
      }
    } else if (lPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 14; x < 32; x++) {
          rowChars[x] = (x > 24) ? 'W' : 'U';
        }
      }
    } else if (lPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 2; x < 12; x++) {
          rowChars[x] = (y < 34) ? 'W' : 'U';
        }
      }
    } else if (lPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 12; x < 22; x++) {
          rowChars[x] = 'W';
        }
      }
    }

    // --- RIGHT ARM / WHITE GLOVE ---
    if (rPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 32; x < 42; x++) {
          rowChars[x] = (y > 44 && x < 39) ? 'W' : (x === 41 || y === 36) ? 'B' : 'u';
        }
      }
    } else if (rPose === 'punch') {
      if (y >= 16 && y < 34) {
        // punch forward/high
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'W' : 'U';
        }
      } else if (y >= 46 && y < 66) {
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'W' : 'U';
        }
      }
    } else if (rPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 36; x < 46; x++) {
          rowChars[x] = (y < 34) ? 'W' : 'U';
        }
      }
    } else if (rPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 26; x < 36; x++) {
          rowChars[x] = 'W';
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export const MEDI_JINX_SPRITES: Record<string, SpriteData> = {
  IDLE_1: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 6 }),
  },
  IDLE_2: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 7 }),
  },
  BLOCK_HIGH: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ leftArmPose: 'block', rightArmPose: 'block' }),
  },
  BLOCK_LOW: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ leftArmPose: 'guard', rightArmPose: 'guard' }),
  },
  TELL_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ leftArmPose: 'tell' }),
  },
  TELL_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ rightArmPose: 'tell' }),
  },
  PUNCH_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ leftArmPose: 'punch' }),
  },
  PUNCH_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ rightArmPose: 'punch' }),
  },
  TELL_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 12, leftArmPose: 'tell' }),
  },
  TELL_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 16, rightArmPose: 'tell' }),
  },
  PUNCH_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 18, leftArmPose: 'punch' }),
  },
  PUNCH_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 10, rightArmPose: 'punch' }),
  },
  TELL_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 10, leftArmPose: 'guard' }),
  },
  TELL_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 10, rightArmPose: 'guard' }),
  },
  PUNCH_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 4, leftArmPose: 'block' }),
  },
  PUNCH_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 4, rightArmPose: 'block' }),
  },
  HIT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 18, headY: 4 }),
  },
  STUNNED: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headX: 10, headY: 8 }),
  },
  KNOCKED_DOWN: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 28 }),
  },
  KO: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ headY: 36 }),
  },
  TAUNT: {
    width: 48,
    height: 96,
    palette: MEDI_PALETTE,
    rows: buildMediRows({ leftArmPose: 'block', rightArmPose: 'guard' }),
  },
};
