import { SpriteData } from './types';

// Palette mappings for Referee & Large Digits
// NES Colors:
// 0x0F: Black outline & hair & shoes (0x0F)
// 0x20: White striped shirt / digit color (0x20)
// 0x27: Skin tone (0x27)
// 0x17: Dark skin tone (0x17)
// 0x02: Blue pants (0x02)
// Total colors: 5 distinct NES colors (< 12)
const REFEREE_PALETTE: Record<string, number> = {
  '.': -1,
  'B': 0x0F,
  'W': 0x20,
  'S': 0x27,
  'K': 0x17,
  'P': 0x02,
};

function buildRefereeRows(countPose: boolean): string[] {
  const width = 32;
  const height = 48;
  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');

    // Head (y: 4..14)
    if (y >= 4 && y < 14) {
      for (let x = 12; x < 20; x++) {
        if (y < 7) {
          rowChars[x] = 'B'; // Hair
        } else if (y === 10 && (x === 14 || x === 17)) {
          rowChars[x] = 'B'; // Eyes
        } else {
          rowChars[x] = 'S'; // Face
        }
      }
    }

    // Striped Shirt (y: 14..30)
    if (y >= 14 && y < 30) {
      for (let x = 8; x < 24; x++) {
        if (x === 8 || x === 23) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = (x % 2 === 0) ? 'B' : 'W'; // Vertical referee stripes
        }
      }

      // Arm counting up
      if (countPose && y >= 10 && y < 22) {
        for (let x = 24; x < 28; x++) {
          rowChars[x] = (y < 14) ? 'S' : (x % 2 === 0) ? 'B' : 'W';
        }
      }
    }

    // Blue Pants (y: 30..44)
    if (y >= 30 && y < 44) {
      for (let x = 10; x < 22; x++) {
        if (x === 10 || x === 21 || (y > 36 && (x === 15 || x === 16))) {
          rowChars[x] = 'B';
        } else {
          rowChars[x] = 'P';
        }
      }
    }

    // Shoes (y: 44..48)
    if (y >= 44 && y < 48) {
      for (let x = 9; x < 23; x++) {
        if (x <= 15 || x >= 17) {
          rowChars[x] = 'B';
        }
      }
    }

    rows.push(rowChars.join(''));
  }
  return rows;
}

export const REFEREE_SPRITES: Record<string, SpriteData> = {
  STAND: {
    width: 32,
    height: 48,
    palette: REFEREE_PALETTE,
    rows: buildRefereeRows(false),
  },
  COUNT: {
    width: 32,
    height: 48,
    palette: REFEREE_PALETTE,
    rows: buildRefereeRows(true),
  },
};

// 16x24 Large Digits for Knockdown Count (0-9)
const DIGIT_PALETTE: Record<string, number> = {
  '.': -1,
  'B': 0x0F, // Black drop shadow/outline
  'W': 0x20, // White digit
  'Y': 0x38, // Yellow highlight
};

// Helper to generate large 12x18 bitmap digits
export function getLargeCountDigitSprite(num: number): SpriteData {
  const width = 14;
  const height = 20;

  // Patterns for 0-9
  const digitPatterns: Record<number, string[]> = {
    1: [
      "....WWWW....",
      "...WWWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "....WWWW....",
      "..WWWWWWWW..",
    ],
    2: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "........WWWW",
      "........WWWW",
      ".......WWWW.",
      "......WWWW..",
      "....WWWW....",
      "...WWWW.....",
      "..WWWW......",
      ".WWWW.......",
      "WWWWWWWWWWWW",
      "WWWWWWWWWWWW",
      "WWWWWWWWWWWW",
    ],
    3: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "........WWWW",
      "........WWWW",
      "....WWWWWW..",
      "....WWWWWW..",
      "........WWWW",
      "........WWWW",
      "........WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
    ],
    4: [
      "....WWWWWW..",
      "...WWWWWWW..",
      "..WWWWWWWW..",
      ".WWWW.WWWW..",
      "WWWW..WWWW..",
      "WWWW..WWWW..",
      "WWWWWWWWWWWW",
      "WWWWWWWWWWWW",
      "......WWWW..",
      "......WWWW..",
      "......WWWW..",
      "......WWWW..",
      "......WWWW..",
      "......WWWW..",
    ],
    5: [
      "WWWWWWWWWWWW",
      "WWWWWWWWWWWW",
      "WWWW........",
      "WWWW........",
      "WWWWWWWWWW..",
      ".WWWWWWWWWW.",
      "........WWWW",
      "........WWWW",
      "........WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
      "............",
    ],
    6: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "WWWW........",
      "WWWWWWWWWW..",
      "WWWWWWWWWWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
      "............",
    ],
    7: [
      "WWWWWWWWWWWW",
      "WWWWWWWWWWWW",
      "WWWW....WWWW",
      ".......WWWW.",
      "......WWWW..",
      ".....WWWW...",
      "....WWWW....",
      "...WWWW.....",
      "...WWWW.....",
      "..WWWW......",
      "..WWWW......",
      "..WWWW......",
      "..WWWW......",
      "..WWWW......",
    ],
    8: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
      "............",
    ],
    9: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWWW",
      "..WWWWWWWWWW",
      "........WWWW",
      "........WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
      "............",
    ],
    0: [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      "WWWW....WWWW",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "............",
      "............",
    ],
  };

  const pattern = digitPatterns[num] || digitPatterns[0];
  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');
    if (y >= 2 && y < 2 + pattern.length) {
      const line = pattern[y - 2];
      for (let x = 0; x < line.length; x++) {
        if (line[x] === 'W') {
          // Yellow face with black shadow
          rowChars[x + 1] = 'Y';
        }
      }
    }
    rows.push(rowChars.join(''));
  }

  return {
    width,
    height,
    palette: DIGIT_PALETTE,
    rows,
  };
}
