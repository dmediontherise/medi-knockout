import fs from 'fs';
import path from 'path';

// Palette mapping per Task 014:
// B black 0x0f (hair, trunks, outline)
// K skin shadow 0x07
// S skin 0x17
// L skin highlight 0x27
// W white waistband 0x20
// R red glove 0x16
// H glove highlight 0x26
// G dark gray 0x00
// . transparent -1
export const PALETTE = {
  '.': -1,
  B: 0x0f,
  K: 0x07,
  S: 0x17,
  L: 0x27,
  W: 0x20,
  R: 0x16,
  H: 0x26,
  G: 0x00,
};

export const FRAMES = [
  'IDLE_A', 'IDLE_B',
  'JAB_L_WIND', 'JAB_L_HIT', 'JAB_L_BACK',
  'JAB_R_WIND', 'JAB_R_HIT', 'JAB_R_BACK',
  'BODY_L_WIND', 'BODY_L_HIT', 'BODY_L_BACK',
  'BODY_R_WIND', 'BODY_R_HIT', 'BODY_R_BACK',
  'STAR_WIND', 'STAR_HIT', 'STAR_BACK',
  'DODGE_L_HALF', 'DODGE_L',
  'DODGE_R_HALF', 'DODGE_R',
  'DUCK', 'BLOCK', 'HIT',
  'EXHAUSTED_A', 'EXHAUSTED_B',
  'FALL', 'DOWN', 'GET_UP', 'WIN'
];

export class PlayerRig {
  constructor() {
    this.canvas = new Map(); // key: `${x},${y}` -> char
  }

  setPixel(x, y, char) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    this.canvas.set(`${ix},${iy}`, char);
  }

  getPixel(x, y) {
    return this.canvas.get(`${Math.round(x)},${Math.round(y)}`);
  }

  drawEllipse(cx, cy, rx, ry, char) {
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0) {
          this.setPixel(x, y, char);
        }
      }
    }
  }

  drawCapsule(x1, y1, x2, y2, radius, char, shadowChar = null, isLeft = true) {
    const minX = Math.floor(Math.min(x1, x2) - radius);
    const maxX = Math.ceil(Math.max(x1, x2) + radius);
    const minY = Math.floor(Math.min(y1, y2) - radius);
    const maxY = Math.ceil(Math.max(y1, y2) + radius);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    const r2 = radius * radius;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let distSq = 0;
        let projX = x1;
        let projY = y1;
        if (l2 === 0) {
          distSq = (x - x1) ** 2 + (y - y1) ** 2;
        } else {
          const t = Math.max(0.0, Math.min(1.0, ((x - x1) * dx + (y - y1) * dy) / l2));
          projX = x1 + t * dx;
          projY = y1 + t * dy;
          distSq = (x - projX) ** 2 + (y - projY) ** 2;
        }

        if (distSq <= r2) {
          const dist = Math.sqrt(distSq);
          let c = char;
          if (shadowChar && dist >= radius - 1.5) {
            if ((isLeft && x < projX) || (!isLeft && x > projX)) {
              c = shadowChar;
            }
          }
          this.setPixel(x, y, c);
        }
      }
    }
  }

  drawQuad(p1, p2, p3, p4, char) {
    const poly = [p1, p2, p3, p4];
    const minX = Math.floor(Math.min(...poly.map(p => p[0])));
    const maxX = Math.ceil(Math.max(...poly.map(p => p[0])));
    const minY = Math.floor(Math.min(...poly.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...poly.map(p => p[1])));

    const pointInPoly = (px, py) => {
      let inside = false;
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    };

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPoly(x + 0.5, y + 0.5)) {
          this.setPixel(x, y, char);
        }
      }
    }
  }

  drawRect(x1, y1, x2, y2, char) {
    const minX = Math.floor(Math.min(x1, x2));
    const maxX = Math.ceil(Math.max(x1, x2));
    const minY = Math.floor(Math.min(y1, y2));
    const maxY = Math.ceil(Math.max(y1, y2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.setPixel(x, y, char);
      }
    }
  }

  applyOutline() {
    // 1-px B outline around opaque perimeter:
    // Every opaque pixel that has a transparent 4-neighbor is B
    const newCanvas = new Map(this.canvas);
    for (const [key] of this.canvas) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const neighbors = [
        `${x + 1},${y}`,
        `${x - 1},${y}`,
        `${x},${y + 1}`,
        `${x},${y - 1}`,
      ];
      for (const nk of neighbors) {
        if (!this.canvas.has(nk)) {
          newCanvas.set(key, 'B');
          break;
        }
      }
    }
    this.canvas = newCanvas;
  }

  toSpriteData() {
    if (this.canvas.size === 0) {
      return { width: 0, height: 0, rows: [], anchorX: 0, minY: 0, maxY: 0, minX: 0, maxX: 0 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const key of this.canvas.keys()) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const anchorX = -minX;

    const rows = [];
    for (let y = minY; y <= maxY; y++) {
      let row = '';
      for (let x = minX; x <= maxX; x++) {
        const c = this.canvas.get(`${x},${y}`);
        row += c !== undefined ? c : '.';
      }
      rows.push(row);
    }

    return {
      width,
      height,
      palette: PALETTE,
      rows,
      anchorX,
      minX,
      maxX,
      minY,
      maxY,
    };
  }
}

export function buildFrame(frameName) {
  const rig = new PlayerRig();

  // Rig coordinate defaults:
  // idle spine: x = 0, idle head top: y = 0
  let head = [0, 12];
  let headRx = 10, headRy = 12;
  let shoulders = [[-20, 32], [20, 32]];
  let elbows = [[-26, 48], [26, 48]];
  let gloves = [[-18, 26], [18, 26]];
  let gloveRadii = [[8, 9], [8, 9]];
  let waist = [[-12, 66], [12, 66]];
  let trunksY = [66, 82];
  let trunksX = [-13, 13];
  let hips = [[-7, 82], [7, 82]];
  let feet = [[-9, 99], [9, 99]];
  let knees = null;
  let raisedArm = null; // 'L', 'R', 'BOTH', or null
  let glovesOverHead = false;

  switch (frameName) {
    case 'IDLE_A':
      break;

    case 'IDLE_B':
      // breathing: head, shoulders, elbows, gloves, waist +1 y
      head[1] += 1;
      shoulders[0][1] += 1; shoulders[1][1] += 1;
      elbows[0][1] += 1; elbows[1][1] += 1;
      gloves[0][1] += 1; gloves[1][1] += 1;
      waist[0][1] += 1; waist[1][1] += 1;
      break;

    case 'JAB_L_WIND':
      gloves[0] = [-20, 36];
      elbows[0] = [-28, 52];
      raisedArm = 'L';
      break;

    case 'JAB_L_HIT':
      head = [2, 13];
      shoulders[0] = [-18, 30];
      elbows[0] = [-12, 10];
      gloves[0] = [-4, -4];
      gloveRadii[0] = [6, 6];
      raisedArm = 'L';
      break;

    case 'JAB_L_BACK':
      elbows[0] = [-20, 28];
      gloves[0] = [-12, 12];
      gloveRadii[0] = [7, 8];
      raisedArm = 'L';
      break;

    case 'JAB_R_WIND':
      gloves[1] = [20, 36];
      elbows[1] = [28, 52];
      raisedArm = 'R';
      break;

    case 'JAB_R_HIT':
      head = [-2, 13];
      shoulders[1] = [18, 30];
      elbows[1] = [12, 10];
      gloves[1] = [4, -4];
      gloveRadii[1] = [6, 6];
      raisedArm = 'R';
      break;

    case 'JAB_R_BACK':
      elbows[1] = [20, 28];
      gloves[1] = [12, 12];
      gloveRadii[1] = [7, 8];
      raisedArm = 'R';
      break;

    case 'BODY_L_WIND':
      gloves[0] = [-20, 36];
      elbows[0] = [-28, 52];
      raisedArm = 'L';
      break;

    case 'BODY_L_HIT':
      head = [3, 14 + 2];
      shoulders[0] = [-20, 32 + 2]; shoulders[1] = [20, 32 + 2];
      elbows = [[-28, 46], [26, 48 + 2]];
      gloves[0] = [-12, 40];
      gloveRadii[0] = [7, 7];
      gloves[1] = [18, 26 + 2];
      waist = [[-12, 66 + 2], [12, 66 + 2]];
      raisedArm = 'L';
      break;

    case 'BODY_L_BACK':
      gloves[0] = [-16, 34];
      elbows[0] = [-24, 46];
      raisedArm = 'L';
      break;

    case 'BODY_R_WIND':
      gloves[1] = [20, 36];
      elbows[1] = [28, 52];
      raisedArm = 'R';
      break;

    case 'BODY_R_HIT':
      head = [-3, 14 + 2];
      shoulders[0] = [-20, 32 + 2]; shoulders[1] = [20, 32 + 2];
      elbows = [[-26, 48 + 2], [28, 46]];
      gloves[0] = [-18, 26 + 2];
      gloves[1] = [12, 40];
      gloveRadii[1] = [7, 7];
      waist = [[-12, 66 + 2], [12, 66 + 2]];
      raisedArm = 'R';
      break;

    case 'BODY_R_BACK':
      gloves[1] = [16, 34];
      elbows[1] = [24, 46];
      raisedArm = 'R';
      break;

    case 'STAR_WIND':
      head = [0, 12 + 6];
      shoulders = [[-20, 32 + 6], [20, 32 + 6]];
      waist = [[-12, 66 + 6], [12, 66 + 6]];
      gloves[0] = [-18, 26 + 6];
      elbows[0] = [-26, 48 + 6];
      gloves[1] = [22, 58];
      elbows[1] = [28, 52];
      raisedArm = 'R';
      break;

    case 'STAR_HIT':
      head = [-3, 12];
      elbows[1] = [18, 8];
      gloves[1] = [6, -14];
      gloveRadii[1] = [7, 8];
      raisedArm = 'R';
      break;

    case 'STAR_BACK':
      gloves[1] = [14, 10];
      elbows[1] = [24, 28];
      raisedArm = 'R';
      break;

    case 'DODGE_L_HALF':
      head = [head[0] - 10, head[1] + 2];
      shoulders = [[shoulders[0][0] - 10, shoulders[0][1] + 2], [shoulders[1][0] - 10, shoulders[1][1] + 2]];
      elbows = [[elbows[0][0] - 10, elbows[0][1] + 2], [elbows[1][0] - 10, elbows[1][1] + 2]];
      gloves = [[gloves[0][0] - 10, gloves[0][1] + 2], [gloves[1][0] - 10, gloves[1][1] + 2]];
      waist = [[waist[0][0] - 4, waist[0][1]], [waist[1][0] - 4, waist[1][1]]];
      trunksX = [-13 - 4, 13 - 4];
      hips = [[hips[0][0] - 3, hips[0][1]], [hips[1][0] - 3, hips[1][1]]];
      feet = [[feet[0][0] - 2, feet[0][1]], [feet[1][0] - 2, feet[1][1]]];
      break;

    case 'DODGE_L':
      head = [head[0] - 20, head[1] + 4];
      shoulders = [[shoulders[0][0] - 20, shoulders[0][1] + 4], [shoulders[1][0] - 20, shoulders[1][1] + 4]];
      elbows = [[elbows[0][0] - 20, elbows[0][1] + 4], [elbows[1][0] - 20, elbows[1][0] + 4]];
      gloves = [[gloves[0][0] - 20, gloves[0][1] + 4], [gloves[1][0] - 20, gloves[1][0] + 4]];
      waist = [[waist[0][0] - 6, waist[0][1]], [waist[1][0] - 6, waist[1][1]]];
      trunksX = [-13 - 6, 13 - 6];
      hips = [[hips[0][0] - 5, hips[0][1]], [hips[1][0] - 5, hips[1][1]]];
      feet = [[feet[0][0] - 4, feet[0][1]], [feet[1][0] - 4, feet[1][1]]];
      break;

    case 'DODGE_R_HALF':
      head = [head[0] + 10, head[1] + 2];
      shoulders = [[shoulders[0][0] + 10, shoulders[0][1] + 2], [shoulders[1][0] + 10, shoulders[1][1] + 2]];
      elbows = [[elbows[0][0] + 10, elbows[0][1] + 2], [elbows[1][0] + 10, elbows[1][1] + 2]];
      gloves = [[gloves[0][0] + 10, gloves[0][1] + 2], [gloves[1][0] + 10, gloves[1][0] + 2]];
      waist = [[waist[0][0] + 4, waist[0][1]], [waist[1][0] + 4, waist[1][1]]];
      trunksX = [-13 + 4, 13 + 4];
      hips = [[hips[0][0] + 3, hips[0][1]], [hips[1][0] + 3, hips[1][1]]];
      feet = [[feet[0][0] + 2, feet[0][1]], [feet[1][0] + 2, feet[1][1]]];
      break;

    case 'DODGE_R':
      head = [head[0] + 20, head[1] + 4];
      shoulders = [[shoulders[0][0] + 20, shoulders[0][1] + 4], [shoulders[1][0] + 20, shoulders[1][1] + 4]];
      elbows = [[elbows[0][0] + 20, elbows[0][1] + 4], [elbows[1][0] + 20, elbows[1][0] + 4]];
      gloves = [[gloves[0][0] + 20, gloves[0][1] + 4], [gloves[1][0] + 20, gloves[1][0] + 4]];
      waist = [[waist[0][0] + 6, waist[0][1]], [waist[1][0] + 6, waist[1][1]]];
      trunksX = [-13 + 6, 13 + 6];
      hips = [[hips[0][0] + 5, hips[0][1]], [hips[1][0] + 5, hips[1][1]]];
      feet = [[feet[0][0] + 4, feet[0][1]], [feet[1][0] + 4, feet[1][1]]];
      break;

    case 'DUCK':
      head = [0, 30];
      shoulders = [[-20, 46], [20, 46]];
      gloves = [[-11, 28], [11, 28]];
      elbows = [[-24, 54], [24, 54]];
      waist = [[-12, 74], [12, 74]];
      trunksY = [74, 86];
      hips = [[-7, 86], [7, 86]];
      knees = [[-12, 92], [12, 92]];
      feet = [[-9, 99], [9, 99]];
      glovesOverHead = true;
      break;

    case 'BLOCK':
      gloves = [[-7, 14], [7, 14]];
      gloveRadii = [[9, 9], [9, 9]];
      elbows = [[-22, 40], [22, 40]];
      glovesOverHead = true;
      break;

    case 'HIT':
      head = [4, 16];
      shoulders = [[-20, 32 + 4], [20, 32 + 4]];
      gloves = [[-26, 34], [26, 34]];
      elbows = [[-30, 50], [30, 50]];
      waist = [[-12, 66 + 4], [12, 66 + 4]];
      break;

    case 'EXHAUSTED_A':
      head = [0, 16];
      gloves = [[-18, 56], [18, 56]];
      elbows = [[-24, 46], [24, 46]];
      break;

    case 'EXHAUSTED_B':
      head = [0, 16 + 2];
      shoulders = [[-20, 32 + 2], [20, 32 + 2]];
      gloves = [[-18, 56 + 2], [18, 56 + 2]];
      elbows = [[-24, 46 + 2], [24, 46 + 2]];
      waist = [[-12, 66 + 2], [12, 66 + 2]];
      break;

    case 'FALL':
      head = [14, 30];
      shoulders = [[-6, 44], [28, 48]];
      elbows = [[-18, 58], [32, 62]];
      gloves = [[-24, 50], [24, 50]];
      waist = [[-8, 76], [14, 78]];
      trunksY = [76, 88];
      trunksX = [-10, 15];
      hips = [[-6, 88], [8, 88]];
      break;

    case 'DOWN':
      // Horizontal across mat: body length horizontal, head on screen-left, gloves resting on chest.
      // Width ~96 px, height <= 40 px.
      // Legs:
      rig.drawCapsule(14, 87, 42, 87, 4.5, 'S', 'K', false);
      rig.drawCapsule(14, 92, 44, 92, 4.5, 'S', 'K', true);
      // Trunks:
      rig.drawRect(-4, 82, 16, 97, 'B');
      rig.drawRect(-4, 82, -1, 97, 'W');
      // Torso:
      rig.drawRect(-24, 83, -4, 96, 'S');
      // Head:
      rig.drawEllipse(-34, 89, 11, 8, 'B');
      for (let y = 83; y <= 86; y++) {
        for (let x = -42; x <= -36; x++) {
          rig.setPixel(x, y, 'G');
        }
      }
      // Gloves resting on chest:
      rig.drawEllipse(-14, 86, 7, 6, 'R');
      rig.drawEllipse(-6, 88, 7, 6, 'R');
      rig.setPixel(-16, 84, 'H');
      rig.setPixel(-8, 86, 'H');
      rig.applyOutline();
      return rig.toSpriteData();

    case 'GET_UP':
      head = [0, 30];
      shoulders = [[-18, 46], [18, 46]];
      gloves = [[-16, 58], [16, 58]];
      elbows = [[-22, 54], [22, 54]];
      waist = [[-12, 72], [12, 72]];
      trunksY = [72, 84];
      hips = [[-8, 84], [8, 84]];
      knees = [[-10, 96], [12, 92]];
      feet = [[-10, 96], [12, 99]];
      break;

    case 'WIN':
      gloves = [[-10, -12], [10, -12]];
      gloveRadii = [[8, 8], [8, 8]];
      elbows = [[-24, 8], [24, 8]];
      raisedArm = 'BOTH';
      break;
  }

  // Draw order:
  // Back to front: legs, trunks, torso, far arm, head, near arm, gloves.
  // Punching or raised arm is drawn last.

  // 1. Legs
  if (knees) {
    if (frameName === 'GET_UP') {
      rig.drawCapsule(hips[0][0], hips[0][1], knees[0][0], knees[0][1], 4.5, 'S', 'K', true);
      rig.drawCapsule(hips[1][0], hips[1][1], knees[1][0], knees[1][1], 4.5, 'S', 'K', false);
      rig.drawCapsule(knees[1][0], knees[1][1], feet[1][0], feet[1][1], 4.5, 'S', 'K', false);
    } else {
      rig.drawCapsule(hips[0][0], hips[0][1], knees[0][0], knees[0][1], 4.5, 'S', 'K', true);
      rig.drawCapsule(hips[1][0], hips[1][1], knees[1][0], knees[1][1], 4.5, 'S', 'K', false);
      rig.drawCapsule(knees[0][0], knees[0][1], feet[0][0], feet[0][1], 4.5, 'S', 'K', true);
      rig.drawCapsule(knees[1][0], knees[1][1], feet[1][0], feet[1][1], 4.5, 'S', 'K', false);
    }
  } else {
    rig.drawCapsule(hips[0][0], hips[0][1], feet[0][0], feet[0][1], 4.5, 'S', 'K', true);
    rig.drawCapsule(hips[1][0], hips[1][1], feet[1][0], feet[1][1], 4.5, 'S', 'K', false);
  }

  // 2. Trunks
  rig.drawRect(trunksX[0], trunksY[0], trunksX[1], trunksY[1], 'B');
  rig.drawRect(trunksX[0], trunksY[0], trunksX[1], trunksY[0] + 2, 'W');
  const centerX = Math.floor((trunksX[0] + trunksX[1]) / 2);
  for (let y = trunksY[0] + 3; y <= trunksY[1]; y++) {
    rig.setPixel(centerX, y, 'G');
  }

  // 3. Torso
  rig.drawQuad(shoulders[0], shoulders[1], waist[1], waist[0], 'S');
  const spineX = Math.floor((shoulders[0][0] + shoulders[1][0]) / 2);
  const spineStartY = Math.floor((shoulders[0][1] + shoulders[1][1]) / 2) + 6;
  const spineEndY = Math.floor((waist[0][1] + waist[1][1]) / 2) - 1;
  for (let y = spineStartY; y <= spineEndY; y++) {
    rig.setPixel(spineX - 1, y, 'K');
    rig.setPixel(spineX, y, 'K');
  }
  const bladeY = Math.floor((shoulders[0][1] + shoulders[1][1]) / 2) + 4;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      rig.setPixel(spineX - 10 + dx, bladeY + dy, 'L');
      rig.setPixel(spineX + 8 + dx, bladeY + dy, 'L');
    }
  }

  // Draw arm helpers
  const drawArmL = () => {
    rig.drawCapsule(shoulders[0][0], shoulders[0][1], elbows[0][0], elbows[0][1], 4, 'S', 'K', true);
    rig.drawCapsule(elbows[0][0], elbows[0][1], gloves[0][0], gloves[0][1], 4, 'S', 'K', true);
  };

  const drawArmR = () => {
    rig.drawCapsule(shoulders[1][0], shoulders[1][1], elbows[1][0], elbows[1][1], 4, 'S', 'K', false);
    rig.drawCapsule(elbows[1][0], elbows[1][1], gloves[1][0], gloves[1][1], 4, 'S', 'K', false);
  };

  const drawGloveL = () => {
    const [gx, gy] = gloves[0];
    const [rx, ry] = gloveRadii[0];
    rig.drawEllipse(gx, gy, rx, ry, 'R');
    for (let y = Math.floor(gy - ry); y <= Math.floor(gy - 1); y++) {
      for (let x = Math.floor(gx - rx); x <= Math.floor(gx - 1); x++) {
        if (((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 <= 0.65) {
          rig.setPixel(x, y, 'H');
        }
      }
    }
  };

  const drawGloveR = () => {
    const [gx, gy] = gloves[1];
    const [rx, ry] = gloveRadii[1];
    rig.drawEllipse(gx, gy, rx, ry, 'R');
    for (let y = Math.floor(gy - ry); y <= Math.floor(gy - 1); y++) {
      for (let x = Math.floor(gx - rx); x <= Math.floor(gx - 1); x++) {
        if (((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 <= 0.65) {
          rig.setPixel(x, y, 'H');
        }
      }
    }
  };

  const drawHeadAndNeck = () => {
    // Neck
    const neckY0 = head[1] + 8;
    const neckY1 = Math.max(neckY0 + 2, Math.floor((shoulders[0][1] + shoulders[1][1]) / 2));
    rig.drawRect(head[0] - 5, neckY0, head[0] + 5, neckY1, 'S');

    // Head
    rig.drawEllipse(head[0], head[1], headRx, headRy, 'B');
    for (let y = Math.floor(head[1] - headRy); y <= Math.floor(head[1] - 2); y++) {
      for (let x = Math.floor(head[0] - headRx); x <= Math.floor(head[0] - 2); x++) {
        const dist = ((x - head[0]) / headRx) ** 2 + ((y - head[1]) / headRy) ** 2;
        if (dist <= 0.85 && dist >= 0.3) {
          if (rig.getPixel(x, y) === 'B') {
            rig.setPixel(x, y, 'G');
          }
        }
      }
    }
    // Two skin ears at mid height
    for (let y = head[1] - 2; y <= head[1] + 2; y++) {
      rig.setPixel(head[0] - 10, y, 'S');
      rig.setPixel(head[0] - 11, y, 'S');
      rig.setPixel(head[0] + 10, y, 'S');
      rig.setPixel(head[0] + 11, y, 'S');
    }
  };

  if (glovesOverHead) {
    drawHeadAndNeck();
    drawArmL();
    drawArmR();
    drawGloveL();
    drawGloveR();
  } else if (raisedArm === 'L') {
    drawArmR();
    drawGloveR();
    drawHeadAndNeck();
    drawArmL();
    drawGloveL();
  } else if (raisedArm === 'R') {
    drawArmL();
    drawGloveL();
    drawHeadAndNeck();
    drawArmR();
    drawGloveR();
  } else if (raisedArm === 'BOTH') {
    drawHeadAndNeck();
    drawArmL();
    drawArmR();
    drawGloveL();
    drawGloveR();
  } else {
    drawArmL();
    drawArmR();
    drawHeadAndNeck();
    drawGloveL();
    drawGloveR();
  }

  rig.applyOutline();
  return rig.toSpriteData();
}

function generatePlayerFile() {
  const outPath = path.resolve('src/render/sprites/generated/player.ts');
  const lines = [
    `// Generated by scripts/build-player.mjs - DO NOT EDIT MANUALLY`,
    `import { SpriteData } from '../types';`,
    ``,
    `export const PLAYER_PALETTE: Record<string, number> = ${JSON.stringify(PALETTE, null, 2)};`,
    ``,
  ];

  const frameExports = [];

  for (const name of FRAMES) {
    const data = buildFrame(name);
    lines.push(`export const PLAYER_${name}: SpriteData = {`);
    lines.push(`  width: ${data.width},`);
    lines.push(`  height: ${data.height},`);
    lines.push(`  palette: PLAYER_PALETTE,`);
    lines.push(`  rows: [`);
    for (const row of data.rows) {
      lines.push(`    ${JSON.stringify(row)},`);
    }
    lines.push(`  ],`);
    lines.push(`};`);
    lines.push(`export const PLAYER_${name}_ANCHOR_X = ${data.anchorX};`);
    lines.push(``);
    frameExports.push(name);
  }

  // Maps for programmatic access
  lines.push(`export const PLAYER_FRAMES: Record<string, SpriteData> = {`);
  for (const name of frameExports) {
    lines.push(`  ${name}: PLAYER_${name},`);
  }
  lines.push(`};`);
  lines.push(``);

  lines.push(`export const PLAYER_ANCHORS: Record<string, number> = {`);
  for (const name of frameExports) {
    lines.push(`  ${name}: PLAYER_${name}_ANCHOR_X,`);
  }
  lines.push(`};`);
  lines.push(``);

  // Backward compatibility: export IDLE_BASE_PLAYER matching PLAYER_IDLE_A
  lines.push(`export const IDLE_BASE_PLAYER: SpriteData = PLAYER_IDLE_A;`);
  lines.push(``);

  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Successfully generated ${outPath} (${FRAMES.length} frames)`);
}

generatePlayerFile();
