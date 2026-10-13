import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

// Load NES palette directly from src/render/nesPalette.ts
const nesPaletteFile = fs.readFileSync('src/render/nesPalette.ts', 'utf8');
const match = nesPaletteFile.match(/export const NES_PALETTE[^=]*=\s*(\[[^;]+\])/s);
if (!match) throw new Error('Could not parse NES_PALETTE from src/render/nesPalette.ts');
const NES_PALETTE = eval(match[1]);

function nearestNesIndex(r, g, b, allowedPalette = null) {
  let bestDist = Infinity;
  let bestIdx = 0;
  const indicesToCheck = allowedPalette ? allowedPalette : NES_PALETTE.map((_, i) => i);
  for (const i of indicesToCheck) {
    const [pr, pg, pb] = NES_PALETTE[i];
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

const CHARACTERS = [
  { id: 'aint_man', file: 'public/assets/aint_man.jpg', crop: null, figBox: { x: 12, y: 5, w: 74, h: 99 }, targetH: 140, targetW: 105 },
  { id: 'medi_jinx', file: 'public/assets/medi_jinx.jpg', crop: null, figBox: { x: 9, y: 10, w: 54, h: 105 }, targetH: 140, targetW: 76 },
  { id: 'dj_tito', file: 'public/assets/dj_tito.jpg', crop: null, figBox: { x: 5, y: 10, w: 52, h: 112 }, targetH: 140, targetW: 72 },
  { id: 'mr_yankee', file: 'public/assets/mr_yankee.jpg', crop: null, figBox: { x: 22, y: 7, w: 55, h: 113 }, targetH: 140, targetW: 72 },
  { id: 'maga_man', file: 'public/assets/maga_man.jpg', crop: null, figBox: { x: 10, y: 8, w: 55, h: 111 }, targetH: 140, targetW: 72 },
  { id: 'player', file: 'public/assets/player_sprites_raw.jpg', crop: { x: 512, y: 512, w: 512, h: 512 }, figBox: { x: 0, y: 16, w: 66, h: 111 }, targetH: 75, targetW: 50 }
];

const OUT_DIR = 'src/render/sprites/generated';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Letter tokens for palette mapping in SpriteData
const PALETTE_TOKENS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

async function buildAllSprites() {
  for (const charConfig of CHARACTERS) {
    console.log(`Processing ${charConfig.id}...`);
    let img = await Jimp.read(charConfig.file);
    if (charConfig.crop) {
      img = img.crop(charConfig.crop);
    }

    // 1. Crop the top-left figure
    const cropped = img.clone().crop(charConfig.figBox);

    // 2. Nearest-neighbour resize to Punch-Out target proportions
    // Nearest-neighbour preserves crisp pixel art
    const targetW = charConfig.targetW;
    const targetH = charConfig.targetH;
    cropped.resize({ w: targetW, h: targetH });

    // 3. Flood fill background starting from image perimeter (near-white pixels)
    const isBgPixel = (x, y) => {
      const idx = (y * targetW + x) * 4;
      const r = cropped.bitmap.data[idx];
      const g = cropped.bitmap.data[idx + 1];
      const b = cropped.bitmap.data[idx + 2];
      return r >= 205 && g >= 205 && b >= 205;
    };

    const isBg = new Uint8Array(targetW * targetH);
    const queue = [];

    // Perimeter seeding
    for (let x = 0; x < targetW; x++) {
      if (isBgPixel(x, 0)) { isBg[x] = 1; queue.push([x, 0]); }
      if (isBgPixel(x, targetH - 1)) { isBg[(targetH - 1) * targetW + x] = 1; queue.push([x, targetH - 1]); }
    }
    for (let y = 0; y < targetH; y++) {
      if (!isBg[y * targetW] && isBgPixel(0, y)) { isBg[y * targetW] = 1; queue.push([0, y]); }
      if (!isBg[y * targetW + targetW - 1] && isBgPixel(targetW - 1, y)) { isBg[y * targetW + targetW - 1] = 1; queue.push([targetW - 1, y]); }
    }

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < targetW && ny >= 0 && ny < targetH && !isBg[ny * targetW + nx]) {
          if (isBgPixel(nx, ny)) {
            isBg[ny * targetW + nx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    // 4. White halo clean-up: remove near-white edge pixels adjacent to background
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        if (!isBg[y * targetW + x]) {
          const idx = (y * targetW + x) * 4;
          const r = cropped.bitmap.data[idx];
          const g = cropped.bitmap.data[idx + 1];
          const b = cropped.bitmap.data[idx + 2];
          if (r > 210 && g > 210 && b > 210) {
            let adjacentToBg = false;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= targetW || ny < 0 || ny >= targetH || isBg[ny * targetW + nx]) {
                adjacentToBg = true;
                break;
              }
            }
            if (adjacentToBg) {
              isBg[y * targetW + x] = 1;
            }
          }
        }
      }
    }

    // 5. Gather color frequencies to quantize to at most 12 NES colors
    const colorCounts = new Map();
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        if (!isBg[y * targetW + x]) {
          const idx = (y * targetW + x) * 4;
          const r = cropped.bitmap.data[idx];
          const g = cropped.bitmap.data[idx + 1];
          const b = cropped.bitmap.data[idx + 2];
          const nes = nearestNesIndex(r, g, b);
          colorCounts.set(nes, (colorCounts.get(nes) || 0) + 1);
        }
      }
    }

    // Sort by frequency and cap at 12 colors
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
    const top12 = sorted.slice(0, 12).map(([idx]) => idx);

    // Map all non-background pixels to the selected top 12 NES palette
    const paletteMap = { '.': -1 };
    top12.forEach((nesIdx, i) => {
      paletteMap[PALETTE_TOKENS[i]] = nesIdx;
    });

    const rows = [];
    for (let y = 0; y < targetH; y++) {
      let rowStr = '';
      for (let x = 0; x < targetW; x++) {
        if (isBg[y * targetW + x]) {
          rowStr += '.';
        } else {
          const idx = (y * targetW + x) * 4;
          const r = cropped.bitmap.data[idx];
          const g = cropped.bitmap.data[idx + 1];
          const b = cropped.bitmap.data[idx + 2];
          const quantized = nearestNesIndex(r, g, b, top12);
          const tokenIndex = top12.indexOf(quantized);
          rowStr += PALETTE_TOKENS[tokenIndex];
        }
      }
      rows.push(rowStr);
    }

    // Export sprite data file
    const content = `import { SpriteData } from '../types';

export const IDLE_BASE_${charConfig.id.toUpperCase()}: SpriteData = {
  width: ${targetW},
  height: ${targetH},
  palette: ${JSON.stringify(paletteMap, null, 2)},
  rows: [
${rows.map(r => `    ${JSON.stringify(r)},`).join('\n')}
  ],
};
`;

    const outPath = path.join(OUT_DIR, `${charConfig.id}.ts`);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}

buildAllSprites().catch(err => {
  console.error(err);
  process.exit(1);
});
