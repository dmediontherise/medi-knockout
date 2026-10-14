import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  'JAB_L_WIND', 'JAB_L_MID', 'JAB_L_HIT', 'JAB_L_BACK',
  'JAB_R_WIND', 'JAB_R_MID', 'JAB_R_HIT', 'JAB_R_BACK',
  'BODY_L_WIND', 'BODY_L_MID', 'BODY_L_HIT', 'BODY_L_BACK',
  'BODY_R_WIND', 'BODY_R_MID', 'BODY_R_HIT', 'BODY_R_BACK',
  'STAR_WIND', 'STAR_MID', 'STAR_HIT', 'STAR_BACK',
  'DODGE_L_HALF', 'DODGE_L',
  'DODGE_R_HALF', 'DODGE_R',
  'DUCK_HALF', 'DUCK',
  'BLOCK_HALF', 'BLOCK',
  'HIT', 'HIT_BACK',
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

function getDefaultKeypoints() {
  return {
    head: [0, 12],
    headRx: 10,
    headRy: 12,
    shoulders: [[-22, 32], [22, 32]],
    elbows: [[-28, 48], [28, 48]],
    gloves: [[-18, 26], [18, 26]],
    gloveRadii: [[11, 12], [11, 12]],
    waist: [[-12, 66], [12, 66]],
    trunksY: [66, 82],
    trunksX: [-13, 13],
    hips: [[-7, 82], [7, 82]],
    feet: [[-9, 99], [9, 99]],
    knees: null,
    raisedArm: null,
    glovesOverHead: false,
  };
}

function cloneKp(kp) {
  return {
    head: [...kp.head],
    headRx: kp.headRx,
    headRy: kp.headRy,
    shoulders: [ [...kp.shoulders[0]], [...kp.shoulders[1]] ],
    elbows: [ [...kp.elbows[0]], [...kp.elbows[1]] ],
    gloves: [ [...kp.gloves[0]], [...kp.gloves[1]] ],
    gloveRadii: [ [...kp.gloveRadii[0]], [...kp.gloveRadii[1]] ],
    waist: [ [...kp.waist[0]], [...kp.waist[1]] ],
    trunksY: [...kp.trunksY],
    trunksX: [...kp.trunksX],
    hips: [ [...kp.hips[0]], [...kp.hips[1]] ],
    feet: [ [...kp.feet[0]], [...kp.feet[1]] ],
    knees: kp.knees ? [ [...kp.knees[0]], [...kp.knees[1]] ] : null,
    raisedArm: kp.raisedArm,
    glovesOverHead: kp.glovesOverHead,
  };
}

function lerpPt(p1, p2, t) {
  return [Math.round(p1[0] + (p2[0] - p1[0]) * t), Math.round(p1[1] + (p2[1] - p1[1]) * t)];
}

function lerpKeypoints(k1, k2, t = 0.5) {
  const k = cloneKp(k1);
  k.head = lerpPt(k1.head, k2.head, t);
  k.headRx = Math.round(k1.headRx + (k2.headRx - k1.headRx) * t);
  k.headRy = Math.round(k1.headRy + (k2.headRy - k1.headRy) * t);
  k.shoulders = [ lerpPt(k1.shoulders[0], k2.shoulders[0], t), lerpPt(k1.shoulders[1], k2.shoulders[1], t) ];
  k.elbows = [ lerpPt(k1.elbows[0], k2.elbows[0], t), lerpPt(k1.elbows[1], k2.elbows[1], t) ];
  k.gloves = [ lerpPt(k1.gloves[0], k2.gloves[0], t), lerpPt(k1.gloves[1], k2.gloves[1], t) ];
  k.gloveRadii = [ lerpPt(k1.gloveRadii[0], k2.gloveRadii[0], t), lerpPt(k1.gloveRadii[1], k2.gloveRadii[1], t) ];
  k.waist = [ lerpPt(k1.waist[0], k2.waist[0], t), lerpPt(k1.waist[1], k2.waist[1], t) ];
  k.trunksY = [ Math.round(k1.trunksY[0] + (k2.trunksY[0] - k1.trunksY[0]) * t), Math.round(k1.trunksY[1] + (k2.trunksY[1] - k1.trunksY[1]) * t) ];
  k.trunksX = [ Math.round(k1.trunksX[0] + (k2.trunksX[0] - k1.trunksX[0]) * t), Math.round(k1.trunksX[1] + (k2.trunksX[1] - k1.trunksX[1]) * t) ];
  k.hips = [ lerpPt(k1.hips[0], k2.hips[0], t), lerpPt(k1.hips[1], k2.hips[1], t) ];
  k.feet = [ lerpPt(k1.feet[0], k2.feet[0], t), lerpPt(k1.feet[1], k2.feet[1], t) ];
  if (k1.knees || k2.knees) {
    const k1knees = k1.knees || [ lerpPt(k1.hips[0], k1.feet[0], 0.5), lerpPt(k1.hips[1], k1.feet[1], 0.5) ];
    const k2knees = k2.knees || [ lerpPt(k2.hips[0], k2.feet[0], 0.5), lerpPt(k2.hips[1], k2.feet[1], 0.5) ];
    k.knees = [ lerpPt(k1knees[0], k2knees[0], t), lerpPt(k1knees[1], k2knees[1], t) ];
  }
  k.raisedArm = k2.raisedArm ?? k1.raisedArm;
  k.glovesOverHead = k1.glovesOverHead || k2.glovesOverHead;
  return k;
}

export function getFrameKeypoints(frameName) {
  const kp = getDefaultKeypoints();

  switch (frameName) {
    case 'IDLE_A':
      return kp;

    case 'IDLE_B':
      kp.head[1] += 1;
      kp.shoulders[0][1] += 1; kp.shoulders[1][1] += 1;
      kp.elbows[0][1] += 1; kp.elbows[1][1] += 1;
      kp.gloves[0][1] += 1; kp.gloves[1][1] += 1;
      kp.waist[0][1] += 1; kp.waist[1][1] += 1;
      return kp;

    case 'JAB_L_WIND':
      kp.gloves[0] = [-20, 36];
      kp.elbows[0] = [-30, 52];
      kp.raisedArm = 'L';
      return kp;

    case 'JAB_L_HIT':
      kp.head = [2, 13];
      kp.shoulders[0] = [-20, 30];
      kp.elbows[0] = [-12, 10];
      kp.gloves[0] = [-4, -4];
      kp.gloveRadii[0] = [9, 9];
      kp.raisedArm = 'L';
      return kp;

    case 'JAB_L_BACK':
      kp.elbows[0] = [-22, 28];
      kp.gloves[0] = [-12, 12];
      kp.gloveRadii[0] = [9, 9];
      kp.raisedArm = 'L';
      return kp;

    case 'JAB_L_MID':
      return lerpKeypoints(getFrameKeypoints('JAB_L_WIND'), getFrameKeypoints('JAB_L_HIT'), 0.5);

    case 'JAB_R_WIND':
      kp.gloves[1] = [20, 36];
      kp.elbows[1] = [30, 52];
      kp.raisedArm = 'R';
      return kp;

    case 'JAB_R_HIT':
      kp.head = [-2, 13];
      kp.shoulders[1] = [20, 30];
      kp.elbows[1] = [12, 10];
      kp.gloves[1] = [4, -4];
      kp.gloveRadii[1] = [9, 9];
      kp.raisedArm = 'R';
      return kp;

    case 'JAB_R_BACK':
      kp.elbows[1] = [22, 28];
      kp.gloves[1] = [12, 12];
      kp.gloveRadii[1] = [9, 9];
      kp.raisedArm = 'R';
      return kp;

    case 'JAB_R_MID':
      return lerpKeypoints(getFrameKeypoints('JAB_R_WIND'), getFrameKeypoints('JAB_R_HIT'), 0.5);

    case 'BODY_L_WIND':
      kp.gloves[0] = [-20, 36];
      kp.elbows[0] = [-30, 52];
      kp.raisedArm = 'L';
      return kp;

    case 'BODY_L_HIT':
      kp.head = [3, 14 + 2];
      kp.shoulders[0] = [-22, 32 + 2]; kp.shoulders[1] = [22, 32 + 2];
      kp.elbows = [[-30, 46], [28, 48 + 2]];
      kp.gloves[0] = [-12, 40];
      kp.gloveRadii[0] = [9, 9];
      kp.gloves[1] = [18, 26 + 2];
      kp.waist = [[-12, 66 + 2], [12, 66 + 2]];
      kp.raisedArm = 'L';
      return kp;

    case 'BODY_L_BACK':
      kp.gloves[0] = [-16, 34];
      kp.elbows[0] = [-26, 46];
      kp.raisedArm = 'L';
      return kp;

    case 'BODY_L_MID':
      return lerpKeypoints(getFrameKeypoints('BODY_L_WIND'), getFrameKeypoints('BODY_L_HIT'), 0.5);

    case 'BODY_R_WIND':
      kp.gloves[1] = [20, 36];
      kp.elbows[1] = [30, 52];
      kp.raisedArm = 'R';
      return kp;

    case 'BODY_R_HIT':
      kp.head = [-3, 14 + 2];
      kp.shoulders[0] = [-22, 32 + 2]; kp.shoulders[1] = [22, 32 + 2];
      kp.elbows = [[-28, 48 + 2], [30, 46]];
      kp.gloves[0] = [-18, 26 + 2];
      kp.gloves[1] = [12, 40];
      kp.gloveRadii[1] = [9, 9];
      kp.waist = [[-12, 66 + 2], [12, 66 + 2]];
      kp.raisedArm = 'R';
      return kp;

    case 'BODY_R_BACK':
      kp.gloves[1] = [16, 34];
      kp.elbows[1] = [26, 46];
      kp.raisedArm = 'R';
      return kp;

    case 'BODY_R_MID':
      return lerpKeypoints(getFrameKeypoints('BODY_R_WIND'), getFrameKeypoints('BODY_R_HIT'), 0.5);

    case 'STAR_WIND':
      kp.head = [0, 12 + 6];
      kp.shoulders = [[-22, 32 + 6], [22, 32 + 6]];
      kp.waist = [[-12, 66 + 6], [12, 66 + 6]];
      kp.gloves[0] = [-18, 26 + 6];
      kp.elbows[0] = [-28, 48 + 6];
      kp.gloves[1] = [22, 58];
      kp.elbows[1] = [30, 52];
      kp.raisedArm = 'R';
      return kp;

    case 'STAR_HIT':
      kp.head = [-3, 12];
      kp.elbows[1] = [18, 8];
      kp.gloves[1] = [6, -14];
      kp.gloveRadii[1] = [9, 9];
      kp.raisedArm = 'R';
      return kp;

    case 'STAR_BACK':
      kp.gloves[1] = [14, 10];
      kp.gloveRadii[1] = [9, 9];
      kp.elbows[1] = [24, 28];
      kp.raisedArm = 'R';
      return kp;

    case 'STAR_MID':
      return lerpKeypoints(getFrameKeypoints('STAR_WIND'), getFrameKeypoints('STAR_HIT'), 0.5);

    case 'DODGE_L_HALF':
      kp.head = [kp.head[0] - 10, kp.head[1] + 2];
      kp.shoulders = [[kp.shoulders[0][0] - 10, kp.shoulders[0][1] + 2], [kp.shoulders[1][0] - 10, kp.shoulders[1][1] + 2]];
      kp.elbows = [[kp.elbows[0][0] - 10, kp.elbows[0][1] + 2], [kp.elbows[1][0] - 10, kp.elbows[1][0] + 2]];
      kp.gloves = [[kp.gloves[0][0] - 10, kp.gloves[0][1] + 2], [kp.gloves[1][0] - 10, kp.gloves[1][1] + 2]];
      kp.waist = [[kp.waist[0][0] - 4, kp.waist[0][1]], [kp.waist[1][0] - 4, kp.waist[1][1]]];
      kp.trunksX = [-13 - 4, 13 - 4];
      kp.hips = [[kp.hips[0][0] - 3, kp.hips[0][1]], [kp.hips[1][0] - 3, kp.hips[1][1]]];
      kp.feet = [[kp.feet[0][0] - 2, kp.feet[0][1]], [kp.feet[1][0] - 2, kp.feet[1][1]]];
      return kp;

    case 'DODGE_L':
      kp.head = [kp.head[0] - 20, kp.head[1] + 4];
      kp.shoulders = [[kp.shoulders[0][0] - 20, kp.shoulders[0][1] + 4], [kp.shoulders[1][0] - 20, kp.shoulders[1][1] + 4]];
      kp.elbows = [[kp.elbows[0][0] - 20, kp.elbows[0][1] + 4], [kp.elbows[1][0] - 20, kp.elbows[1][0] + 4]];
      kp.gloves = [[kp.gloves[0][0] - 20, kp.gloves[0][1] + 4], [kp.gloves[1][0] - 20, kp.gloves[1][0] + 4]];
      kp.waist = [[kp.waist[0][0] - 6, kp.waist[0][1]], [kp.waist[1][0] - 6, kp.waist[1][1]]];
      kp.trunksX = [-13 - 6, 13 - 6];
      kp.hips = [[kp.hips[0][0] - 5, kp.hips[0][1]], [kp.hips[1][0] - 5, kp.hips[1][1]]];
      kp.feet = [[kp.feet[0][0] - 4, kp.feet[0][1]], [kp.feet[1][0] - 4, kp.feet[1][1]]];
      return kp;

    case 'DODGE_R_HALF':
      kp.head = [kp.head[0] + 10, kp.head[1] + 2];
      kp.shoulders = [[kp.shoulders[0][0] + 10, kp.shoulders[0][1] + 2], [kp.shoulders[1][0] + 10, kp.shoulders[1][1] + 2]];
      kp.elbows = [[kp.elbows[0][0] + 10, kp.elbows[0][1] + 2], [kp.elbows[1][0] + 10, kp.elbows[1][1] + 2]];
      kp.gloves = [[kp.gloves[0][0] + 10, kp.gloves[0][1] + 2], [kp.gloves[1][0] + 10, kp.gloves[1][0] + 2]];
      kp.waist = [[kp.waist[0][0] + 4, kp.waist[0][1]], [kp.waist[1][0] + 4, kp.waist[1][1]]];
      kp.trunksX = [-13 + 4, 13 + 4];
      kp.hips = [[kp.hips[0][0] + 3, kp.hips[0][1]], [kp.hips[1][0] + 3, kp.hips[1][1]]];
      kp.feet = [[kp.feet[0][0] + 2, kp.feet[0][1]], [kp.feet[1][0] + 2, kp.feet[1][1]]];
      return kp;

    case 'DODGE_R':
      kp.head = [kp.head[0] + 20, kp.head[1] + 4];
      kp.shoulders = [[kp.shoulders[0][0] + 20, kp.shoulders[0][1] + 4], [kp.shoulders[1][0] + 20, kp.shoulders[1][1] + 4]];
      kp.elbows = [[kp.elbows[0][0] + 20, kp.elbows[0][1] + 4], [kp.elbows[1][0] + 20, kp.elbows[1][1] + 4]];
      kp.gloves = [[kp.gloves[0][0] + 20, kp.gloves[0][1] + 4], [kp.gloves[1][0] + 20, kp.gloves[1][0] + 4]];
      kp.waist = [[kp.waist[0][0] + 6, kp.waist[0][1]], [kp.waist[1][0] + 6, kp.waist[1][1]]];
      kp.trunksX = [-13 + 6, 13 + 6];
      kp.hips = [[kp.hips[0][0] + 5, kp.hips[0][1]], [kp.hips[1][0] + 5, kp.hips[1][1]]];
      kp.feet = [[kp.feet[0][0] + 4, kp.feet[0][1]], [kp.feet[1][0] + 4, kp.feet[1][1]]];
      return kp;

    case 'DUCK':
      kp.head = [0, 31];
      kp.shoulders = [[-22, 47], [22, 47]];
      kp.gloves = [[-11, 31], [11, 31]];
      kp.elbows = [[-26, 55], [26, 55]];
      kp.waist = [[-12, 75], [12, 75]];
      kp.trunksY = [75, 87];
      kp.hips = [[-7, 87], [7, 87]];
      kp.knees = [[-12, 93], [12, 93]];
      kp.feet = [[-9, 99], [9, 99]];
      kp.glovesOverHead = true;
      return kp;

    case 'DUCK_HALF':
      return lerpKeypoints(getFrameKeypoints('IDLE_A'), getFrameKeypoints('DUCK'), 0.5);

    case 'BLOCK':
      kp.gloves = [[-7, 14], [7, 14]];
      kp.gloveRadii = [[10, 10], [10, 10]];
      kp.elbows = [[-24, 40], [24, 40]];
      kp.glovesOverHead = true;
      return kp;

    case 'BLOCK_HALF':
      return lerpKeypoints(getFrameKeypoints('IDLE_A'), getFrameKeypoints('BLOCK'), 0.5);

    case 'HIT':
      kp.head = [4, 16];
      kp.shoulders = [[-22, 32 + 4], [22, 32 + 4]];
      kp.gloves = [[-26, 34], [26, 34]];
      kp.elbows = [[-32, 50], [32, 50]];
      kp.waist = [[-12, 66 + 4], [12, 66 + 4]];
      return kp;

    case 'HIT_BACK':
      return lerpKeypoints(getFrameKeypoints('HIT'), getFrameKeypoints('IDLE_A'), 0.5);

    case 'EXHAUSTED_A':
      kp.head = [0, 16];
      kp.gloves = [[-18, 56], [18, 56]];
      kp.elbows = [[-26, 46], [26, 46]];
      return kp;

    case 'EXHAUSTED_B':
      kp.head = [0, 16 + 2];
      kp.shoulders = [[-22, 32 + 2], [22, 32 + 2]];
      kp.gloves = [[-18, 56 + 2], [18, 56 + 2]];
      kp.elbows = [[-26, 46 + 2], [26, 46 + 2]];
      kp.waist = [[-12, 66 + 2], [12, 66 + 2]];
      return kp;

    case 'FALL':
      kp.head = [14, 30];
      kp.shoulders = [[-6, 44], [28, 48]];
      kp.elbows = [[-20, 58], [32, 62]];
      kp.gloves = [[-24, 50], [24, 50]];
      kp.waist = [[-8, 76], [14, 78]];
      kp.trunksY = [76, 88];
      kp.trunksX = [-10, 15];
      kp.hips = [[-6, 88], [8, 88]];
      return kp;

    case 'GET_UP':
      kp.head = [0, 30];
      kp.shoulders = [[-20, 46], [20, 46]];
      kp.gloves = [[-16, 58], [16, 58]];
      kp.elbows = [[-24, 54], [24, 54]];
      kp.waist = [[-12, 72], [12, 72]];
      kp.trunksY = [72, 84];
      kp.hips = [[-8, 84], [8, 84]];
      kp.knees = [[-10, 96], [12, 92]];
      kp.feet = [[-10, 96], [12, 99]];
      return kp;

    case 'WIN':
      kp.gloves = [[-10, -12], [10, -12]];
      kp.gloveRadii = [[9, 9], [9, 9]];
      kp.elbows = [[-26, 8], [26, 8]];
      kp.raisedArm = 'BOTH';
      return kp;

    default:
      return kp;
  }
}

export function buildFrame(frameName) {
  const rig = new PlayerRig();

  if (frameName === 'DOWN') {
    // Redrawn per Task 015 Requirement 7 & Task 017 Requirement 1:
    // Legs: 11 px capsules (radius 5.5)
    rig.drawCapsule(14, 88, 25, 70, 5.5, 'S');
    rig.drawCapsule(25, 70, 37, 91, 5.5, 'S');
    rig.drawCapsule(16, 91, 31, 69, 5.5, 'S');
    rig.drawCapsule(31, 69, 41, 93, 5.5, 'S');
    // Feet:
    rig.drawCapsule(37, 93, 42, 95, 3, 'B');

    // Trunks:
    rig.drawRect(0, 78, 18, 95, 'B');
    // Waistband:
    rig.drawRect(-1, 75, 18, 77, 'W');

    // Torso: skin block at least 14 px tall (76 to 91 = 16 px):
    rig.drawRect(-24, 76, 0, 91, 'S');

    // Head: black hair ellipse at screen-left:
    rig.drawEllipse(-34, 85, 9.5, 7.5, 'B');
    rig.drawEllipse(-30, 85, 6, 5, 'S');

    // Gloves: both red gloves resting on chest, each >= 150 px:
    rig.drawEllipse(-19, 84, 9, 8.5, 'R');
    rig.drawEllipse(3, 84, 9, 8.5, 'R');
    // Highlight H:
    for (let y = 84 - 8; y <= 84 - 1; y++) {
      for (let x = -19 - 9; x <= -19 - 1; x++) {
        if (((x - (-19)) / 9) ** 2 + ((y - 84) / 8.5) ** 2 <= 0.65) {
          rig.setPixel(x, y, 'H');
        }
      }
      for (let x = 3 - 9; x <= 3 - 1; x++) {
        if (((x - 3) / 9) ** 2 + ((y - 84) / 8.5) ** 2 <= 0.65) {
          rig.setPixel(x, y, 'H');
        }
      }
    }

    rig.applyOutline();
    return rig.toSpriteData();
  }

  const kp = getFrameKeypoints(frameName);
  const {
    head, headRx, headRy,
    shoulders, elbows, gloves, gloveRadii,
    waist, trunksY, trunksX,
    hips, feet, knees,
    raisedArm, glovesOverHead
  } = kp;

  // Draw order:
  // 1. Legs: 11 px (radius 5.5)
  if (knees) {
    if (frameName === 'GET_UP') {
      rig.drawCapsule(hips[0][0], hips[0][1], knees[0][0], knees[0][1], 5.5, 'S', 'K', true);
      rig.drawCapsule(hips[1][0], hips[1][1], knees[1][0], knees[1][1], 5.5, 'S', 'K', false);
      rig.drawCapsule(knees[1][0], knees[1][1], feet[1][0], feet[1][1], 5.5, 'S', 'K', false);
    } else {
      rig.drawCapsule(hips[0][0], hips[0][1], knees[0][0], knees[0][1], 5.5, 'S', 'K', true);
      rig.drawCapsule(hips[1][0], hips[1][1], knees[1][0], knees[1][1], 5.5, 'S', 'K', false);
      rig.drawCapsule(knees[0][0], knees[0][1], feet[0][0], feet[0][1], 5.5, 'S', 'K', true);
      rig.drawCapsule(knees[1][0], knees[1][1], feet[1][0], feet[1][1], 5.5, 'S', 'K', false);
    }
  } else {
    rig.drawCapsule(hips[0][0], hips[0][1], feet[0][0], feet[0][1], 5.5, 'S', 'K', true);
    rig.drawCapsule(hips[1][0], hips[1][1], feet[1][0], feet[1][1], 5.5, 'S', 'K', false);
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

  // 4. Arms & Forearms: 12 px (radius 6.5)
  const drawArmL = () => {
    rig.drawCapsule(shoulders[0][0], shoulders[0][1], elbows[0][0], elbows[0][1], 6.5, 'S', 'K', true);
    rig.drawCapsule(elbows[0][0], elbows[0][1], gloves[0][0], gloves[0][1], 6.5, 'S', 'K', true);
  };

  const drawArmR = () => {
    rig.drawCapsule(shoulders[1][0], shoulders[1][1], elbows[1][0], elbows[1][1], 6.5, 'S', 'K', false);
    rig.drawCapsule(elbows[1][0], elbows[1][1], gloves[1][0], gloves[1][1], 6.5, 'S', 'K', false);
  };

  const drawGlove = (idx, isLeft) => {
    const [gx, gy] = gloves[idx];
    const [rx, ry] = gloveRadii[idx];
    const [ex, ey] = elbows[idx];

    // Red glove
    rig.drawEllipse(gx, gy, rx, ry, 'R');

    // Glove highlight H
    for (let y = Math.floor(gy - ry); y <= Math.floor(gy - 1); y++) {
      for (let x = Math.floor(gx - rx); x <= Math.floor(gx - 1); x++) {
        if (((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 <= 0.65) {
          rig.setPixel(x, y, 'H');
        }
      }
    }

    // 2-px B cuff line where glove meets forearm
    const dx = ex - gx;
    const dy = ey - gy;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const ux = dx / len;
      const uy = dy / len;
      const vx = -uy;
      const vy = ux;
      const rEdge = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
      for (let t = rEdge - 2; t <= rEdge; t += 0.5) {
        for (let s = -6; s <= 6; s += 0.5) {
          const px = Math.round(gx + ux * t + vx * s);
          const py = Math.round(gy + uy * t + vy * s);
          if (((px - gx) / rx) ** 2 + ((py - gy) / ry) ** 2 <= 1.0) {
            rig.setPixel(px, py, 'B');
          }
        }
      }
    }
  };

  const drawHeadAndNeck = () => {
    const neckY0 = head[1] + 8;
    const neckY1 = Math.max(neckY0 + 2, Math.floor((shoulders[0][1] + shoulders[1][1]) / 2));
    rig.drawRect(head[0] - 5, neckY0, head[0] + 5, neckY1, 'S');

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
    drawGlove(0, true);
    drawGlove(1, false);
  } else if (raisedArm === 'L') {
    drawArmR();
    drawGlove(1, false);
    drawHeadAndNeck();
    drawArmL();
    drawGlove(0, true);
  } else if (raisedArm === 'R') {
    drawArmL();
    drawGlove(0, true);
    drawHeadAndNeck();
    drawArmR();
    drawGlove(1, false);
  } else if (raisedArm === 'BOTH') {
    drawHeadAndNeck();
    drawArmL();
    drawArmR();
    drawGlove(0, true);
    drawGlove(1, false);
  } else {
    drawArmL();
    drawArmR();
    drawHeadAndNeck();
    drawGlove(0, true);
    drawGlove(1, false);
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  generatePlayerFile();
}
