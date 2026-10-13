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

const FIGURE_BOXES = {
  aint_man: [
    [12, 7, 85, 103], [93, 7, 166, 103], [175, 7, 235, 104], [250, 7, 323, 103],
    [9, 129, 89, 225], [95, 129, 174, 226], [178, 129, 257, 226], [260, 129, 327, 226],
    [9, 257, 75, 352], [88, 257, 154, 352], [166, 257, 233, 352], [248, 255, 310, 352],
    [8, 376, 80, 462], [85, 379, 166, 462]
  ],
  medi_jinx: [
    [9, 10, 61, 113], [95, 10, 180, 114], [194, 10, 279, 113], [8, 129, 80, 235],
    [104, 128, 177, 234], [200, 128, 271, 234], [11, 252, 76, 357], [98, 254, 179, 357],
    [196, 252, 274, 352], [190, 362, 259, 462], [41, 398, 152, 462]
  ],
  dj_tito: [
    [5, 10, 56, 121], [98, 19, 186, 121], [210, 19, 298, 121], [7, 143, 92, 246],
    [98, 142, 170, 247], [180, 140, 255, 247], [264, 140, 316, 247], [7, 260, 90, 363],
    [100, 262, 169, 359], [201, 266, 281, 353], [177, 360, 301, 460], [50, 385, 148, 460]
  ],
  mr_yankee: [
    [22, 7, 76, 119], [110, 7, 203, 119], [220, 7, 313, 119], [10, 132, 103, 245],
    [10, 247, 103, 356], [109, 132, 191, 244], [215, 132, 306, 244], [106, 250, 197, 356],
    [216, 250, 322, 353], [209, 358, 291, 462], [42, 388, 168, 462]
  ],
  maga_man: [
    [10, 8, 64, 118], [102, 8, 193, 119], [205, 8, 282, 119], [8, 136, 79, 243],
    [104, 138, 178, 243], [200, 139, 287, 243], [11, 250, 97, 353], [105, 250, 180, 353],
    [198, 253, 287, 353], [172, 359, 263, 461], [26, 394, 148, 461]
  ]
};

const ACTION_MAP = {
  aint_man: {
    IDLE: 0,
    TELL_JAB: 3,
    PUNCH_JAB: 4,
    TELL_HOOK: 7,
    PUNCH_HOOK: 6,
    TELL_UPPERCUT: 12,
    PUNCH_UPPERCUT: 11,
    BLOCK_HIGH: 3,
    BLOCK_LOW: 10,
    HIT: 2,
    STUNNED: 10,
    KNOCKED_DOWN: 'LIE',
    KO: 'LIE',
    TAUNT: 13,
  },
  medi_jinx: {
    IDLE: 0,
    TELL_JAB: 6,
    PUNCH_JAB: 2,
    TELL_HOOK: 3,
    PUNCH_HOOK: 1,
    TELL_UPPERCUT: 5,
    PUNCH_UPPERCUT: 9,
    BLOCK_HIGH: 6,
    BLOCK_LOW: 6,
    HIT: 8,
    STUNNED: 8,
    KNOCKED_DOWN: 10,
    KO: 10,
    TAUNT: 4,
  },
  dj_tito: {
    IDLE: 0,
    TELL_JAB: 5,
    PUNCH_JAB: 1,
    TELL_HOOK: 6,
    PUNCH_HOOK: 7,
    TELL_UPPERCUT: 8,
    PUNCH_UPPERCUT: 4,
    BLOCK_HIGH: 5,
    BLOCK_LOW: 8,
    HIT: 9,
    STUNNED: 9,
    KNOCKED_DOWN: 11,
    KO: 11,
    TAUNT: 10,
  },
  mr_yankee: {
    IDLE: 0,
    TELL_JAB: 3,
    PUNCH_JAB: 1,
    TELL_HOOK: 7,
    PUNCH_HOOK: 8,
    TELL_UPPERCUT: 4,
    PUNCH_UPPERCUT: 9,
    BLOCK_HIGH: 5,
    BLOCK_LOW: 7,
    HIT: 3,
    STUNNED: 3,
    KNOCKED_DOWN: 10,
    KO: 10,
    TAUNT: 9,
  },
  maga_man: {
    IDLE: 0,
    TELL_JAB: 2,
    PUNCH_JAB: 1,
    TELL_HOOK: 7,
    PUNCH_HOOK: 6,
    TELL_UPPERCUT: 4,
    PUNCH_UPPERCUT: 3,
    BLOCK_HIGH: 2,
    BLOCK_LOW: 7,
    HIT: 2,
    STUNNED: 0,
    KNOCKED_DOWN: 10,
    KO: 10,
    TAUNT: 9,
  },
};

const OPPONENTS = [
  { id: 'aint_man', file: 'public/assets/aint_man.jpg' },
  { id: 'medi_jinx', file: 'public/assets/medi_jinx.jpg' },
  { id: 'dj_tito', file: 'public/assets/dj_tito.jpg' },
  { id: 'mr_yankee', file: 'public/assets/mr_yankee.jpg' },
  { id: 'maga_man', file: 'public/assets/maga_man.jpg' },
];

const OUT_DIR = 'src/render/sprites/generated';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Letter tokens for palette mapping in SpriteData
const PALETTE_TOKENS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Function to process an image into quantized SpriteData
async function processSpriteImage(img, box, targetW, targetH, charId, rotateCcw = false, fixedPalette = null) {
  let cropped = img.clone().crop(box);
  cropped.resize({ w: targetW, h: targetH });
  if (rotateCcw) {
    // 90 deg counter-clockwise rotation
    cropped.rotate(270);
    const tempW = targetW;
    targetW = targetH;
    targetH = tempW;
  }

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

  let top12;
  let paletteMap;

  if (fixedPalette) {
    paletteMap = fixedPalette;
    top12 = Object.entries(fixedPalette)
      .filter(([k]) => k !== '.')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, v]) => v);
  } else {
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
    top12 = sorted.slice(0, 12).map(([idx]) => idx);

    paletteMap = { '.': -1 };
    top12.forEach((nesIdx, i) => {
      paletteMap[PALETTE_TOKENS[i]] = nesIdx;
    });
  }

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

  for (const opp of OPPONENTS) {
    console.log(`Processing ${opp.id}...`);
    const img = await Jimp.read(opp.file);
    const boxes = FIGURE_BOXES[opp.id];
    const idleBox = boxes[0];
    const idleH = idleBox[3] - idleBox[1] + 1;
    const factor = 140 / idleH;

    const usedIndices = new Set();
    let usesLie = false;
    for (const [action, fig] of Object.entries(ACTION_MAP[opp.id])) {
      if (fig === 'LIE') {
        usesLie = true;
      } else {
        usedIndices.add(fig);
      }
    }

    // Process idle figure 0 first to establish the character's base palette
    const idleSrcW = idleBox[2] - idleBox[0] + 1;
    const idleSrcH = idleBox[3] - idleBox[1] + 1;
    const idleTargetW = Math.round(idleSrcW * factor);
    const idleTargetH = Math.round(idleSrcH * factor);
    const idleBoxCrop = { x: idleBox[0], y: idleBox[1], w: idleSrcW, h: idleSrcH };

    const idleSprite = await processSpriteImage(img, idleBoxCrop, idleTargetW, idleTargetH, opp.id, false, null);
    const charPalette = idleSprite.palette;

    const sprites = {
      'FIG_0': idleSprite,
    };

    for (const figIdx of usedIndices) {
      if (figIdx === 0) continue;
      const b = boxes[figIdx];
      const srcW = b[2] - b[0] + 1;
      const srcH = b[3] - b[1] + 1;
      const targetW = Math.round(srcW * factor);
      const targetH = Math.round(srcH * factor);
      const box = { x: b[0], y: b[1], w: srcW, h: srcH };

      const sprite = await processSpriteImage(img, box, targetW, targetH, opp.id, false, charPalette);
      sprites[`FIG_${figIdx}`] = sprite;
    }

    if (usesLie) {
      // AINT MAN LIE: rotate idle figure 0 by 90 deg counter-clockwise (lossless transpose),
      // then scale down with nearest-neighbour so height <= 86 px and width 105-125 px.
      const idle = sprites['FIG_0'];
      const transW = idle.height; // 140
      const transH = idle.width;  // 107
      const transRows = [];
      for (let y = 0; y < transH; y++) {
        let r = '';
        for (let x = 0; x < transW; x++) {
          const sx = (idle.width - 1) - y;
          const sy = x;
          r += idle.rows[sy][sx];
        }
        transRows.push(r);
      }

      // Nearest-neighbour scale down to width: 112, height: 85
      const lieW = 112;
      const lieH = 85;
      const lieRows = [];
      for (let y = 0; y < lieH; y++) {
        const sy = Math.floor(y * transH / lieH);
        let r = '';
        for (let x = 0; x < lieW; x++) {
          const sx = Math.floor(x * transW / lieW);
          r += transRows[sy][sx];
        }
        lieRows.push(r);
      }

      sprites['LIE'] = {
        width: lieW,
        height: lieH,
        palette: idle.palette,
        rows: lieRows,
      };
    }

    spriteMapConfig[opp.id] = {
      sheet: opp.file,
      idleFigureIndex: 0,
      scaleFactor: factor,
      figureBoxes: boxes,
      actionMap: ACTION_MAP[opp.id],
    };

    const upId = opp.id.toUpperCase();
    let content = `import { SpriteData } from '../types';\n\n`;
    content += `export const IDLE_BASE_${upId}: SpriteData = {\n`;
    content += `  width: ${sprites['FIG_0'].width},\n`;
    content += `  height: ${sprites['FIG_0'].height},\n`;
    content += `  palette: ${JSON.stringify(sprites['FIG_0'].palette, null, 2)},\n`;
    content += `  rows: [\n${sprites['FIG_0'].rows.map(r => `    ${JSON.stringify(r)},`).join('\n')}\n  ],\n};\n\n`;

    // Export each generated frame
    for (const [key, sprite] of Object.entries(sprites)) {
      if (key === 'FIG_0') continue;
      content += `export const ${upId}_${key}: SpriteData = {\n`;
      content += `  width: ${sprite.width},\n`;
      content += `  height: ${sprite.height},\n`;
      content += `  palette: ${JSON.stringify(sprite.palette, null, 2)},\n`;
      content += `  rows: [\n${sprite.rows.map(r => `    ${JSON.stringify(r)},`).join('\n')}\n  ],\n};\n\n`;
    }

    // Export map dictionary: maps figure index / 'LIE' to SpriteData
    content += `export const ${upId}_FRAMES: Record<number | string, SpriteData> = {\n`;
    content += `  0: IDLE_BASE_${upId},\n`;
    for (const key of Object.keys(sprites)) {
      if (key === 'FIG_0') continue;
      if (key === 'LIE') {
        content += `  LIE: ${upId}_LIE,\n`;
      } else {
        const num = key.replace('FIG_', '');
        content += `  ${num}: ${upId}_${key},\n`;
      }
    }
    content += `};\n`;

    const outPath = path.join(OUT_DIR, `${opp.id}.ts`);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`Wrote ${outPath}`);
  }

  // Player sprite
  console.log('Processing player...');
  let playerImg = await Jimp.read('public/assets/player_sprites_raw.jpg');
  playerImg = playerImg.crop({ x: 512, y: 512, w: 512, h: 512 });
  const playerSprite = await processSpriteImage(playerImg, { x: 0, y: 16, w: 66, h: 111 }, 50, 75, 'player', false);

  const playerContent = `import { SpriteData } from '../types';

export const IDLE_BASE_PLAYER: SpriteData = {
  width: ${playerSprite.width},
  height: ${playerSprite.height},
  palette: ${JSON.stringify(playerSprite.palette, null, 2)},
  rows: [
${playerSprite.rows.map(r => `    ${JSON.stringify(r)},`).join('\n')}
  ],
};
`;
  const playerOutPath = path.join(OUT_DIR, 'player.ts');
  fs.writeFileSync(playerOutPath, playerContent, 'utf8');
  console.log(`Wrote ${playerOutPath}`);

  spriteMapConfig['player'] = {
    sheet: 'public/assets/player_sprites_raw.jpg',
    idleFigureIndex: 0,
  };

  const mapPath = 'scripts/sprite-map.json';
  fs.writeFileSync(mapPath, JSON.stringify(spriteMapConfig, null, 2), 'utf8');
  console.log(`Wrote ${mapPath}`);
}

buildAllSprites().catch(err => {
  console.error(err);
  process.exit(1);
});
