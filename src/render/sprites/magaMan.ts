import { SpriteData } from './types';

// Palette mappings for MAGA MAN
// Character traits: Swept blond hair, tan/orange skin, white t-shirt, khaki pants, red gloves
// NES Colors:
// 0x0F: Black outline (0x0F)
// 0x38: Bright blond hair (0x38)
// 0x28: Golden blond hair shadow (0x28)
// 0x17: Tan/orange skin tone (0x17)
// 0x27: Light tan skin tone (0x27)
// 0x20: White t-shirt (0x20)
// 0x10: Light gray t-shirt shading (0x10)
// 0x18: Khaki pants (0x18)
// 0x08: Dark khaki pants shadow (0x08)
// 0x16: Red gloves (0x16)
// Total colors: 10 distinct NES colors (< 12)
const MAGA_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black outline
  'Y': 0x38, // Bright blond hair
  'G': 0x28, // Golden blond shadow
  'K': 0x17, // Tan/orange skin tone
  'S': 0x27, // Light tan skin tone
  'W': 0x20, // White t-shirt
  'A': 0x10, // Light gray
  'E': 0x18, // Khaki pants
  'D': 0x08, // Dark khaki
  'R': 0x16, // Red gloves
};

function buildMagaRows(options: {
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

    // --- SWEPT BLOND HAIR & TAN FACE (y from headY to headY + 24) ---
    if (y >= headY && y < headY + 24) {
      const relY = y - headY;
      const hWidth = relY < 4 ? 18 : relY < 18 ? 20 : 16;
      const left = headX + (20 - hWidth) / 2;
      const right = left + hWidth;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 0 || relY === 23) {
          rowChars[x] = 'B';
        } else if (relY < 9) {
          // Swept-over voluminous blond hair swooping to one side
          if (x < left + 10) {
            rowChars[x] = 'Y'; // bright swooping blond hair
          } else {
            rowChars[x] = 'G'; // golden blond shading
          }
        } else if (relY >= 9 && relY < 18) {
          // Tan face with both eyes visible
          if (relY === 13 && (x === left + 5 || x === right - 6)) {
            rowChars[x] = 'W'; // Eye
          } else if (relY === 13 && (x === left + 6 || x === right - 7)) {
            rowChars[x] = 'B'; // Pupil
          } else {
            rowChars[x] = (x < left + 6) ? 'S' : 'K'; // Tan/orange skin
          }
        } else {
          // Neck / chin
          rowChars[x] = (relY === 22) ? 'B' : 'K';
        }
      }
    }

    // --- WHITE T-SHIRT (y from 30 to 64) ---
    if (y >= 30 && y < 64) {
      const relY = y - 30;
      const tWidth = relY < 12 ? 28 : relY < 24 ? 26 : 22;
      const left = 24 - tWidth / 2;
      const right = 24 + tWidth / 2;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 33) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x < 18) ? 'W' : (x > 30) ? 'A' : 'W';
        }
      }
    }

    // --- KHAKI PANTS (y from 64 to 96) ---
    if (y >= 64 && y < 96) {
      const relY = y - 64;
      const left = 14;
      const right = 34;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || (relY > 8 && (x === 23 || x === 24))) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x < 24) ? 'E' : 'D'; // Khaki pants
        }
      }
    }

    // --- LEFT ARM / RED GLOVE ---
    if (lPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 6; x < 16; x++) {
          rowChars[x] = (y > 44 && x > 9) ? 'R' : (x === 6 || y === 36) ? 'B' : 'K';
        }
      }
    } else if (lPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 14; x < 32; x++) {
          rowChars[x] = (x > 24) ? 'R' : 'K';
        }
      }
    } else if (lPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 2; x < 12; x++) {
          rowChars[x] = (y < 34) ? 'R' : 'K';
        }
      }
    } else if (lPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 12; x < 22; x++) {
          rowChars[x] = 'R';
        }
      }
    }

    // --- RIGHT ARM / RED GLOVE ---
    if (rPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 32; x < 42; x++) {
          rowChars[x] = (y > 44 && x < 39) ? 'R' : (x === 41 || y === 36) ? 'B' : 'K';
        }
      }
    } else if (rPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'R' : 'K';
        }
      }
    } else if (rPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 36; x < 46; x++) {
          rowChars[x] = (y < 34) ? 'R' : 'K';
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

export const MAGA_MAN_SPRITES: Record<string, SpriteData> = {
  IDLE_1: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 6 }),
  },
  IDLE_2: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 7 }),
  },
  BLOCK_HIGH: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ leftArmPose: 'block', rightArmPose: 'block' }),
  },
  BLOCK_LOW: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ leftArmPose: 'guard', rightArmPose: 'guard' }),
  },
  TELL_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ leftArmPose: 'tell' }),
  },
  TELL_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ rightArmPose: 'tell' }),
  },
  PUNCH_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ leftArmPose: 'punch' }),
  },
  PUNCH_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ rightArmPose: 'punch' }),
  },
  TELL_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 12, leftArmPose: 'tell' }),
  },
  TELL_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 16, rightArmPose: 'tell' }),
  },
  PUNCH_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 18, leftArmPose: 'punch' }),
  },
  PUNCH_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 10, rightArmPose: 'punch' }),
  },
  TELL_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 10, leftArmPose: 'guard' }),
  },
  TELL_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 10, rightArmPose: 'guard' }),
  },
  PUNCH_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 4, leftArmPose: 'block' }),
  },
  PUNCH_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 4, rightArmPose: 'block' }),
  },
  HIT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 18, headY: 4 }),
  },
  STUNNED: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headX: 10, headY: 8 }),
  },
  KNOCKED_DOWN: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 28 }),
  },
  KO: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ headY: 36 }),
  },
  TAUNT: {
    width: 48,
    height: 96,
    palette: MAGA_PALETTE,
    rows: buildMagaRows({ leftArmPose: 'block', rightArmPose: 'guard' }),
  },
};
