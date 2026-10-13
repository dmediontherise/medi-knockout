import { SpriteData, mirrorSprite } from './types';

// Palette mappings for AINT MAN (Gold football helmet with mask, white jersey with gold trim & number, gold pants, dark gloves)
// NES Colors:
// 0x0F: Black outline (0x0F)
// 0x28: Gold / Yellow helmet and pants (0x28)
// 0x38: Light Gold highlight (0x38)
// 0x18: Dark Gold shadow (0x18)
// 0x20: White jersey (0x20)
// 0x10: Light Gray jersey shadow (0x10)
// 0x00: Gray face mask / gloves (0x00)
// 0x17: Skin shadow (0x17)
// 0x27: Skin tone (0x27)
// Total colors: 9 distinct NES colors (< 12)
const AINT_PALETTE: Record<string, number> = {
  '.': -1, // transparent
  'B': 0x0F, // Black
  'G': 0x28, // Gold
  'Y': 0x38, // Light gold
  'D': 0x18, // Dark gold
  'W': 0x20, // White
  'A': 0x10, // Light gray
  'M': 0x00, // Medium gray (facemask/gloves)
  'S': 0x27, // Skin
  'K': 0x17, // Skin shadow
};

// Procedural builder for consistent 48x96 opponent sprite frames
function buildOpponentRows(options: {
  headY?: number;
  headX?: number;
  mouthOpen?: boolean;
  leftArmPose?: 'guard' | 'punch' | 'tell' | 'block' | 'down' | 'flail';
  rightArmPose?: 'guard' | 'punch' | 'tell' | 'block' | 'down' | 'flail';
  duckOffset?: number;
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

    // --- HELMET & HEAD (y from headY to headY + 24) ---
    if (y >= headY && y < headY + 24) {
      const relY = y - headY;
      const hWidth = relY < 4 ? 12 : relY < 18 ? 20 : 16;
      const left = headX + (20 - hWidth) / 2;
      const right = left + hWidth;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 0 || relY === 23) {
          rowChars[x] = 'B'; // Outline
        } else if (relY < 12) {
          rowChars[x] = (x < left + 4) ? 'Y' : (x > right - 5) ? 'D' : 'G'; // Helmet
        } else if (relY >= 12 && relY < 18) {
          // Face & mask
          if (relY % 2 === 0 || x === left + 8 || x === right - 9) {
            rowChars[x] = 'M'; // Face mask bars
          } else {
            rowChars[x] = (x > left + 5 && x < right - 6) ? 'S' : 'B'; // Eyes/skin
          }
        } else {
          // Chin & neck
          rowChars[x] = (relY === 22) ? 'B' : 'K';
        }
      }
    }

    // --- TORSO / JERSEY (y from 30 to 64) ---
    if (y >= 30 && y < 64) {
      const relY = y - 30;
      const tWidth = relY < 12 ? 28 : relY < 24 ? 26 : 22;
      const left = 24 - tWidth / 2;
      const right = 24 + tWidth / 2;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || relY === 33) {
          rowChars[x] = 'B';
        } else if (relY < 6) {
          // Gold shoulder trim
          rowChars[x] = 'G';
        } else if (relY >= 10 && relY <= 20 && x >= 21 && x <= 26) {
          // Jersey Number 9
          rowChars[x] = 'G';
        } else {
          rowChars[x] = (x < 18) ? 'W' : (x > 30) ? 'A' : 'W'; // White jersey with shading
        }
      }
    }

    // --- PANTS & LEGS (y from 64 to 96) ---
    if (y >= 64 && y < 96) {
      const relY = y - 64;
      const left = 14;
      const right = 34;

      for (let x = left; x < right; x++) {
        if (x === left || x === right - 1 || (relY > 8 && x === 23) || (relY > 8 && x === 24)) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x < 24) ? 'G' : 'D'; // Gold football pants
        }
      }
    }

    // --- LEFT ARM / GLOVE ---
    if (lPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 6; x < 16; x++) {
          rowChars[x] = (y > 44 && x > 9) ? 'M' : (x === 6 || y === 36) ? 'B' : 'K';
        }
      }
    } else if (lPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 14; x < 32; x++) {
          rowChars[x] = (x > 24) ? 'M' : 'K';
        }
      }
    } else if (lPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 2; x < 12; x++) {
          rowChars[x] = (y < 34) ? 'M' : 'K';
        }
      }
    } else if (lPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 12; x < 22; x++) {
          rowChars[x] = 'M';
        }
      }
    }

    // --- RIGHT ARM / GLOVE ---
    if (rPose === 'guard') {
      if (y >= 36 && y < 54) {
        for (let x = 32; x < 42; x++) {
          rowChars[x] = (y > 44 && x < 39) ? 'M' : (x === 41 || y === 36) ? 'B' : 'K';
        }
      }
    } else if (rPose === 'punch') {
      if (y >= 46 && y < 66) {
        for (let x = 16; x < 34; x++) {
          rowChars[x] = (x < 24) ? 'M' : 'K';
        }
      }
    } else if (rPose === 'tell') {
      if (y >= 26 && y < 44) {
        for (let x = 36; x < 46; x++) {
          rowChars[x] = (y < 34) ? 'M' : 'K';
        }
      }
    } else if (rPose === 'block') {
      if (y >= 20 && y < 40) {
        for (let x = 26; x < 36; x++) {
          rowChars[x] = 'M';
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export const AINT_MAN_SPRITES: Record<string, SpriteData> = {
  IDLE_1: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 6 }),
  },
  IDLE_2: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 7 }), // 1px breathing shift
  },
  BLOCK_HIGH: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ leftArmPose: 'block', rightArmPose: 'block' }),
  },
  BLOCK_LOW: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ leftArmPose: 'guard', rightArmPose: 'guard' }),
  },
  TELL_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ leftArmPose: 'tell' }),
  },
  TELL_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ rightArmPose: 'tell' }),
  },
  PUNCH_JAB_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ leftArmPose: 'punch' }),
  },
  PUNCH_JAB_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ rightArmPose: 'punch' }),
  },
  TELL_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 12, leftArmPose: 'tell' }),
  },
  TELL_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 16, rightArmPose: 'tell' }),
  },
  PUNCH_HOOK_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 18, leftArmPose: 'punch' }),
  },
  PUNCH_HOOK_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 10, rightArmPose: 'punch' }),
  },
  TELL_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 10, leftArmPose: 'guard' }),
  },
  TELL_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 10, rightArmPose: 'guard' }),
  },
  PUNCH_UPPERCUT_LEFT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 4, leftArmPose: 'block' }),
  },
  PUNCH_UPPERCUT_RIGHT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 4, rightArmPose: 'block' }),
  },
  HIT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 18, headY: 4 }),
  },
  STUNNED: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headX: 10, headY: 8 }),
  },
  KNOCKED_DOWN: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 28 }), // collapsed down
  },
  KO: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ headY: 36 }),
  },
  TAUNT: {
    width: 48,
    height: 96,
    palette: AINT_PALETTE,
    rows: buildOpponentRows({ leftArmPose: 'block', rightArmPose: 'guard' }),
  },
};
