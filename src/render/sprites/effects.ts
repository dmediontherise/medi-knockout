import { SpriteData } from './types';

// Small palette-indexed effect sprites (<= 16x16 each)
// 0x20: White, 0x28: Yellow/Gold, 0x16: Red

// Impact spark on block/hit (8x8)
export const SPARK_SPRITE: SpriteData = {
  width: 8,
  height: 8,
  palette: {
    '.': -1,
    'W': 0x20, // White core
    'Y': 0x28, // Gold/Yellow ray
    'R': 0x16, // Red edge
  },
  rows: [
    '...YY...',
    '..YYYY..',
    '.YYWWYY.',
    'YYWWWWYY',
    'YYWWWWYY',
    '.YYWWYY.',
    '..YYYY..',
    '...YY...',
  ],
};

// Dizzy star for stunned effect (8x8)
export const STAR_SPRITE: SpriteData = {
  width: 8,
  height: 8,
  palette: {
    '.': -1,
    'W': 0x20, // White highlight
    'Y': 0x28, // Yellow star
    'D': 0x07, // Dark outline
  },
  rows: [
    '...YY...',
    '...YY...',
    '.YYYYYY.',
    'YYYYYYYY',
    '..YYYY..',
    '.YY..YY.',
    'YY....YY',
    '........',
  ],
};
