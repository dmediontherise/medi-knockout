// Ring backdrop, crowd, ropes, posts, ring canvas drawing helpers
// NES Punch-Out!! ring geometry:
// Back crowd: y: 48 .. 88
// Top rope: y = 88
// Middle rope: y = 104
// Bottom rope: y = 120
// Ring apron/mat: y: 120 .. 240
// Left post: x = 20
// Right post: x = 236
// Palette colors:
// Crowd: 0x0F (Black), 0x00 (Gray silhouette heads), 0x10 (Lighter silhouette heads)
// Post: 0x16 (Red post) with 0x20 (White wrap)
// Ropes: 0x16 (Red top), 0x20 (White middle), 0x12 (Blue bottom)
// Ring mat: 0x19 (Punch-out blue/teal mat) or 0x03 (Deep teal mat) with 0x0F mat lines

export const RING_COLORS = {
  BACKGROUND_TOP: 0x0F, // Black above ring/crowd (y: 0..48)
  CROWD_BG: 0x0F,       // Crowd background
  CROWD_DARK: 0x00,     // Dark gray crowd heads
  CROWD_LIGHT: 0x10,    // Light gray crowd heads
  POST: 0x16,           // Red post
  POST_WRAP: 0x20,      // White wrap
  ROPE_TOP: 0x16,       // Red rope
  ROPE_MID: 0x20,       // White rope
  ROPE_BOT: 0x12,       // Blue rope
  MAT_TOP: 0x19,        // Ring mat teal
  MAT_LINE: 0x0F,       // Black mat edge / perimeter
  MAT_CORNER: 0x16,     // Red corner pad
  CANVAS_BORDER: 0x0F,
};

// Procedural crowd rows for buffer caching or direct scanline render
export function drawRingBackground(
  setPixel: (x: number, y: number, nesColor: number) => void,
  frameTick: number = 0
) {
  // 1. Black ceiling / HUD background (y: 0..47)
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 256; x++) {
      setPixel(x, y, 0x0F);
    }
  }

  // 2. Crowd section (y: 48..88)
  for (let y = 48; y < 88; y++) {
    for (let x = 0; x < 256; x++) {
      // Crowd silhouettes (spectator heads)
      // Subtle crowd bobbing or camera flash
      const isFlash = (frameTick % 60 < 2) && (x % 37 === 0) && (y % 7 === 0);
      if (isFlash) {
        setPixel(x, y, 0x20); // Camera flash in crowd
        continue;
      }

      const headCol = Math.floor(x / 8);
      const headX = x % 8;
      const headRow = Math.floor((y - 48) / 10);
      const headY = (y - 48) % 10;

      // Draw silhouette head
      if (headY >= 2 && headY <= 7 && headX >= 1 && headX <= 6) {
        const shade = ((headCol + headRow) % 2 === 0) ? RING_COLORS.CROWD_DARK : RING_COLORS.CROWD_LIGHT;
        setPixel(x, y, shade);
      } else {
        setPixel(x, y, RING_COLORS.CROWD_BG);
      }
    }
  }

  // 3. Ring Mat (y: 88..240)
  for (let y = 88; y < 240; y++) {
    for (let x = 0; x < 256; x++) {
      // Perspective ring mat lines or solid Punch-Out blue mat
      if (y === 88 || y === 89) {
        // Mat top border
        setPixel(x, y, 0x0F);
      } else {
        setPixel(x, y, RING_COLORS.MAT_TOP);
      }
    }
  }

  // 4. Ring Posts (Left: x: 18..24, Right: x: 232..238)
  for (let y = 72; y < 140; y++) {
    for (let x = 18; x <= 24; x++) {
      setPixel(x, y, (y % 6 < 3) ? RING_COLORS.POST : RING_COLORS.POST_WRAP);
    }
    for (let x = 232; x <= 238; x++) {
      setPixel(x, y, (y % 6 < 3) ? RING_COLORS.POST : RING_COLORS.POST_WRAP);
    }
  }

  // 5. 3 Ropes across ring (horizontal lines at y: 88, y: 104, y: 120)
  // Top Rope: y = 88..90 (Red)
  for (let x = 24; x < 232; x++) {
    setPixel(x, 88, RING_COLORS.ROPE_TOP);
    setPixel(x, 89, 0x0F); // Rope drop shadow
  }

  // Middle Rope: y = 104..106 (White)
  for (let x = 24; x < 232; x++) {
    setPixel(x, 104, RING_COLORS.ROPE_MID);
    setPixel(x, 105, 0x0F);
  }

  // Bottom Rope: y = 120..122 (Blue)
  for (let x = 24; x < 232; x++) {
    setPixel(x, 120, RING_COLORS.ROPE_BOT);
    setPixel(x, 121, 0x0F);
  }
}
