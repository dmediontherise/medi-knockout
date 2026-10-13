// Sprite definition interfaces
export interface SpriteData {
  width: number;
  height: number;
  palette: Record<string, number>; // char -> NES palette index (0x00..0x3F)
  rows: string[];
}

export function mirrorSprite(sprite: SpriteData): SpriteData {
  return {
    width: sprite.width,
    height: sprite.height,
    palette: { ...sprite.palette },
    rows: sprite.rows.map((row) => row.split('').reverse().join('')),
  };
}

// Helper to validate sprite colors
export function getDistinctNesIndices(sprite: SpriteData): number[] {
  const set = new Set<number>();
  for (const [char, idx] of Object.entries(sprite.palette)) {
    if (char === '.') continue; // transparent
    set.add(idx);
  }
  return Array.from(set);
}
