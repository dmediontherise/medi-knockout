import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

// Load NES palette directly from src/render/nesPalette.ts
const nesPaletteFile = fs.readFileSync('src/render/nesPalette.ts', 'utf8');
const match = nesPaletteFile.match(/export const NES_PALETTE[^=]*=\s*(\[[^;]+\])/s);
if (!match) throw new Error('Could not parse NES_PALETTE from src/render/nesPalette.ts');
const NES_PALETTE = eval(match[1]);

// sRGB to CIELAB conversion for perceptual matching
function rgbToLab(r, g, b) {
  let rL = r / 255, gL = g / 255, bL = b / 255;
  rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
  gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
  bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

  let X = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) * 100;
  let Y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) * 100;
  let Z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) * 100;

  X /= 95.047; Y /= 100.000; Z /= 108.883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
  const fX = f(X), fY = f(Y), fZ = f(Z);
  return [(116 * fY) - 16, 500 * (fX - fY), 200 * (fY - fZ)];
}

const NES_LAB = NES_PALETTE.map(([r, g, b]) => rgbToLab(r, g, b));

function nearestNesLab(r, g, b, allowed = null, charId = '') {
  // Preserve true black (prevent turning to dark olive/brown)
  if (r < 40 && g < 40 && b < 40) {
    if (allowed) {
      if (allowed.includes(0x0F)) return 0x0F;
      if (allowed.includes(0x0D)) return 0x0D;
    } else {
      return 0x0F;
    }
  }

  // Preserve true gold/yellow for aint_man helmet and pants
  if (charId === 'aint_man' && r > 150 && g > 120 && b < 100) {
    const golds = [0x28, 0x38, 0x37, 0x27];
    const sub = allowed ? allowed.filter(x => golds.includes(x)) : golds;
    if (sub.length > 0) return sub[0];
  }

  // Preserve true blue skin tone for medi_jinx
  if (charId === 'medi_jinx' && (b > r + 10 || b > g + 10) && b > 50) {
    const blues = [0x11, 0x12, 0x21, 0x22];
    const sub = allowed ? allowed.filter(x => blues.includes(x)) : blues;
    if (sub.length > 0) return sub[0];
  }

  const lab = rgbToLab(r, g, b);
  let bestDist = Infinity;
  let bestIdx = 0;
  const list = allowed ? allowed : NES_PALETTE.map((_, i) => i);
  for (const i of list) {
    const nLab = NES_LAB[i];
    const d = (lab[0] - nLab[0]) ** 2 + (lab[1] - nLab[1]) ** 2 + (lab[2] - nLab[2]) ** 2;
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

// Function to process an image box into quantized SpriteData
async function processSpriteImage(img, box, targetW, targetH, charId) {
  const cropped = img.clone().crop(box);
  cropped.resize({ w: targetW, h: targetH });

  const isBgPixel = (x, y) => {
    const idx = (y * targetW + x) * 4;
    const r = cropped.bitmap.data[idx];
    const g = cropped.bitmap.data[idx + 1];
    const b = cropped.bitmap.data[idx + 2];
    return r >= 205 && g >= 205 && b >= 205;
  };

  const isBg = new Uint8Array(targetW * targetH);
  const queue = [];

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
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < targetW && ny >= 0 && ny < targetH && !isBg[ny * targetW + nx]) {
        if (isBgPixel(nx, ny)) {
          isBg[ny * targetW + nx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  // Halo clean-up
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
            const nx = x + dx, ny = y + dy;
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

  // Count colors perceptually
  const colorCounts = new Map();
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      if (!isBg[y * targetW + x]) {
        const idx = (y * targetW + x) * 4;
        const r = cropped.bitmap.data[idx];
        const g = cropped.bitmap.data[idx + 1];
        const b = cropped.bitmap.data[idx + 2];
        const nes = nearestNesLab(r, g, b, null, charId);
        colorCounts.set(nes, (colorCounts.get(nes) || 0) + 1);
      }
    }
  }

  // Ensure key characteristic colors are included in the top 12
  if (charId === 'aint_man' && !colorCounts.has(0x28) && !colorCounts.has(0x38) && !colorCounts.has(0x37)) {
    colorCounts.set(0x37, 500);
  }
  if (charId === 'medi_jinx' && !colorCounts.has(0x11) && !colorCounts.has(0x12) && !colorCounts.has(0x21) && !colorCounts.has(0x22)) {
    colorCounts.set(0x11, 500);
  }
  if (colorCounts.has(0x08) && (charId === 'medi_jinx' || charId === 'dj_tito')) {
    colorCounts.delete(0x08);
  }
  if (colorCounts.has(0x18) && (charId === 'medi_jinx' || charId === 'dj_tito')) {
    colorCounts.delete(0x18);
  }

  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top12 = sorted.slice(0, 12).map(([idx]) => idx);

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
        const quantized = nearestNesLab(r, g, b, top12, charId);
        const tokenIndex = top12.indexOf(quantized);
        rowStr += (tokenIndex !== -1) ? PALETTE_TOKENS[tokenIndex] : '.';
      }
    }
    rows.push(rowStr);
  }

  return { width: targetW, height: targetH, palette: paletteMap, rows };
}

async function buildAllSprites() {
  const spriteMapConfig = {};

  for (const charConfig of CHARACTERS) {
    console.log(`Processing ${charConfig.id}...`);
    let img = await Jimp.read(charConfig.file);
    if (charConfig.crop) {
      img = img.crop(charConfig.crop);
    }

    // Process clean Idle base frame
    const idleSprite = await processSpriteImage(img, charConfig.figBox, charConfig.targetW, charConfig.targetH, charConfig.id);

    spriteMapConfig[charConfig.id] = {
      sheet: charConfig.file,
      idleFigureIndex: 0,
    };

    const content = `import { SpriteData } from '../types';

export const IDLE_BASE_${charConfig.id.toUpperCase()}: SpriteData = {
  width: ${idleSprite.width},
  height: ${idleSprite.height},
  palette: ${JSON.stringify(idleSprite.palette, null, 2)},
  rows: [
${idleSprite.rows.map(r => `    ${JSON.stringify(r)},`).join('\n')}
  ],
};
`;

    const outPath = path.join(OUT_DIR, `${charConfig.id}.ts`);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`Wrote ${outPath}`);
  }

  const mapPath = 'scripts/sprite-map.json';
  fs.writeFileSync(mapPath, JSON.stringify(spriteMapConfig, null, 2), 'utf8');
  console.log(`Wrote ${mapPath}`);
}

buildAllSprites().catch(err => {
  console.error(err);
  process.exit(1);
});
