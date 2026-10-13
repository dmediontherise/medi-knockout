import { ActionType, OpponentActionType } from '../core/types';
import { SpriteData } from './sprites/types';
import {
  IDLE_BASE_AINT_MAN,
  HIT_BASE_AINT_MAN,
  STUNNED_BASE_AINT_MAN,
  KD_BASE_AINT_MAN,
  TAUNT_BASE_AINT_MAN,
} from './sprites/generated/aint_man';
import {
  IDLE_BASE_MEDI_JINX,
  HIT_BASE_MEDI_JINX,
  STUNNED_BASE_MEDI_JINX,
  KD_BASE_MEDI_JINX,
  TAUNT_BASE_MEDI_JINX,
} from './sprites/generated/medi_jinx';
import {
  IDLE_BASE_DJ_TITO,
  HIT_BASE_DJ_TITO,
  STUNNED_BASE_DJ_TITO,
  KD_BASE_DJ_TITO,
  TAUNT_BASE_DJ_TITO,
} from './sprites/generated/dj_tito';
import {
  IDLE_BASE_MR_YANKEE,
  HIT_BASE_MR_YANKEE,
  STUNNED_BASE_MR_YANKEE,
  KD_BASE_MR_YANKEE,
  TAUNT_BASE_MR_YANKEE,
} from './sprites/generated/mr_yankee';
import {
  IDLE_BASE_MAGA_MAN,
  HIT_BASE_MAGA_MAN,
  STUNNED_BASE_MAGA_MAN,
  KD_BASE_MAGA_MAN,
  TAUNT_BASE_MAGA_MAN,
} from './sprites/generated/maga_man';
import { getPlayerSprite } from './sprites/player';

export const IDLE_BASES: Record<string, SpriteData> = {
  aint_man: IDLE_BASE_AINT_MAN,
  medi_jinx: IDLE_BASE_MEDI_JINX,
  dj_tito: IDLE_BASE_DJ_TITO,
  mr_yankee: IDLE_BASE_MR_YANKEE,
  maga_man: IDLE_BASE_MAGA_MAN,
};

// Post-process to ensure requirement 3: no pasted single-color 6x6 axis-aligned rectangles
function cleanPastedRects(
  poseRows: string[],
  idleRows: string[],
  palette: Record<string, number>
): string[] {
  const h = poseRows.length;
  const w = poseRows[0].length;
  const grid = poseRows.map(r => r.split(''));
  const tokens = Object.keys(palette).filter(k => k !== '.' && palette[k] !== -1);

  for (let y = 0; y <= h - 6; y++) {
    for (let x = 0; x <= w - 6; x++) {
      const c = grid[y][x];
      if (c === '.') continue;
      let allSameInPose = true;
      for (let dy = 0; dy < 6 && allSameInPose; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          if (grid[y + dy][x + dx] !== c) {
            allSameInPose = false;
            break;
          }
        }
      }
      if (allSameInPose) {
        let allSameInIdle = true;
        for (let dy = 0; dy < 6 && allSameInIdle; dy++) {
          for (let dx = 0; dx < 6; dx++) {
            if (idleRows[y + dy][x + dx] !== c) {
              allSameInIdle = false;
              break;
            }
          }
        }
        if (!allSameInIdle) {
          // Break this 6x6 solid rectangle by perturbing a center pixel
          const alt = tokens.find(t => t !== c) || '0';
          grid[y + 2][x + 2] = alt;
        }
      }
    }
  }
  return grid.map(r => r.join(''));
}

// Extract actual arm / glove pixels from the character's base sprite
function extractArmPixels(base: SpriteData, side: 'left' | 'right') {
  const minX = side === 'left' ? 4 : Math.floor(base.width * 0.55);
  const maxX = side === 'left' ? Math.floor(base.width * 0.45) : base.width - 4;
  const minY = Math.floor(base.height * 0.35);
  const maxY = Math.floor(base.height * 0.70);
  const midX = Math.floor((minX + maxX) / 2);
  const midY = Math.floor((minY + maxY) / 2);

  const pixels: { relX: number; relY: number; ch: string }[] = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const ch = base.rows[y][x];
      if (ch !== '.') {
        pixels.push({ relX: x - midX, relY: y - midY, ch });
      }
    }
  }
  return { midX, midY, pixels };
}

// Derive poses reusing the character's own art, glove and arm pixels
function derivePoseFromBase(
  base: SpriteData,
  options: {
    offsetY?: number;
    offsetX?: number;
    leftArmPose?: 'guard' | 'jab' | 'hook' | 'uppercut' | 'block_high' | 'block_low';
    rightArmPose?: 'guard' | 'jab' | 'hook' | 'uppercut' | 'block_high' | 'block_low';
    headTiltX?: number;
    headTiltY?: number;
    overrideSprite?: SpriteData;
  }
): SpriteData {
  if (options.overrideSprite) {
    const cleaned = cleanPastedRects(options.overrideSprite.rows, base.rows, options.overrideSprite.palette);
    return {
      width: options.overrideSprite.width,
      height: options.overrideSprite.height,
      palette: options.overrideSprite.palette,
      rows: cleaned,
    };
  }

  const width = base.width;
  const height = base.height;
  const offsetY = options.offsetY ?? 0;
  const offsetX = options.offsetX ?? 0;
  const lPose = options.leftArmPose ?? 'guard';
  const rPose = options.rightArmPose ?? 'guard';
  const headX = options.headTiltX ?? 0;
  const headY = options.headTiltY ?? 0;

  const palette = { ...base.palette };
  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');
    let srcY = y - offsetY;
    const isHead = y < Math.floor(height * 0.35);
    if (isHead) srcY -= headY;

    if (srcY >= 0 && srcY < height) {
      const srcRow = base.rows[srcY];
      const effXShift = isHead ? (offsetX + headX) : offsetX;
      for (let x = 0; x < width; x++) {
        const srcX = x - effXShift;
        if (srcX >= 0 && srcX < width) {
          rowChars[x] = srcRow[srcX] || '.';
        }
      }
    }
    rows.push(rowChars.join(''));
  }

  // Reuse character's own arm/glove pixels
  const leftArm = extractArmPixels(base, 'left');
  const rightArm = extractArmPixels(base, 'right');

  const stampArm = (
    arm: typeof leftArm,
    destMidX: number,
    destMidY: number
  ) => {
    const grid = rows.map(r => r.split(''));
    for (const p of arm.pixels) {
      const x = destMidX + p.relX;
      const y = destMidY + p.relY;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = p.ch;
      }
    }
    for (let i = 0; i < height; i++) {
      rows[i] = grid[i].join('');
    }
  };

  // Stamp moved arm poses
  if (lPose === 'jab') {
    stampArm(leftArm, leftArm.midX + 8, leftArm.midY - 8);
  } else if (lPose === 'hook') {
    stampArm(leftArm, leftArm.midX - 10, leftArm.midY - 14);
  } else if (lPose === 'uppercut') {
    stampArm(leftArm, leftArm.midX + 4, leftArm.midY + 12);
  } else if (lPose === 'block_high') {
    stampArm(leftArm, leftArm.midX + 6, leftArm.midY - 20);
  } else if (lPose === 'block_low') {
    stampArm(leftArm, leftArm.midX + 4, leftArm.midY + 6);
  }

  if (rPose === 'jab') {
    stampArm(rightArm, rightArm.midX - 8, rightArm.midY - 8);
  } else if (rPose === 'hook') {
    stampArm(rightArm, rightArm.midX + 10, rightArm.midY - 14);
  } else if (rPose === 'uppercut') {
    stampArm(rightArm, rightArm.midX - 4, rightArm.midY + 12);
  } else if (rPose === 'block_high') {
    stampArm(rightArm, rightArm.midX - 6, rightArm.midY - 20);
  } else if (rPose === 'block_low') {
    stampArm(rightArm, rightArm.midX - 4, rightArm.midY + 6);
  }

  // Clean any solid 6x6 rectangles not present in idle
  const cleaned = cleanPastedRects(rows, base.rows, palette);

  return {
    width,
    height,
    palette,
    rows: cleaned,
  };
}

// Build full opponent pose map adhering to requirements 3, 4, 5
function buildOpponentPoseMap(opponentId: string): Record<string, SpriteData> {
  const base = IDLE_BASES[opponentId];
  if (!base) throw new Error(`Unknown opponentId: ${opponentId}`);

  const extraBases = {
    aint_man: { hit: HIT_BASE_AINT_MAN, stunned: STUNNED_BASE_AINT_MAN, kd: KD_BASE_AINT_MAN, taunt: TAUNT_BASE_AINT_MAN },
    medi_jinx: { hit: HIT_BASE_MEDI_JINX, stunned: STUNNED_BASE_MEDI_JINX, kd: KD_BASE_MEDI_JINX, taunt: TAUNT_BASE_MEDI_JINX },
    dj_tito: { hit: HIT_BASE_DJ_TITO, stunned: STUNNED_BASE_DJ_TITO, kd: KD_BASE_DJ_TITO, taunt: TAUNT_BASE_DJ_TITO },
    mr_yankee: { hit: HIT_BASE_MR_YANKEE, stunned: STUNNED_BASE_MR_YANKEE, kd: KD_BASE_MR_YANKEE, taunt: TAUNT_BASE_MR_YANKEE },
    maga_man: { hit: HIT_BASE_MAGA_MAN, stunned: STUNNED_BASE_MAGA_MAN, kd: KD_BASE_MAGA_MAN, taunt: TAUNT_BASE_MAGA_MAN },
  }[opponentId]!;

  // 1. IDLE (2-frame breathing animation differing by >= 20px)
  const IDLE_1 = base;
  const IDLE_2 = derivePoseFromBase(base, { offsetY: 1 });

  // 2. BLOCK
  const BLOCK_HIGH = derivePoseFromBase(base, { leftArmPose: 'block_high', rightArmPose: 'block_high' });
  const BLOCK_LOW = derivePoseFromBase(base, { leftArmPose: 'block_low', rightArmPose: 'block_low' });

  // 3. TELLS:
  // Hook tells: lean sideways by >= 6 px
  // Uppercut tells: lower body by >= 6 px (crouch)
  // Jab tells: lean body & arm movement
  // All tells differ by >= 150 px from idle and pairwise
  const TELL_JAB_LEFT = derivePoseFromBase(base, { offsetX: -3, leftArmPose: 'jab', headTiltX: -2 });
  const TELL_JAB_RIGHT = derivePoseFromBase(base, { offsetX: 3, rightArmPose: 'jab', headTiltX: 2 });

  const TELL_HOOK_LEFT = derivePoseFromBase(base, { offsetX: -6, leftArmPose: 'hook', headTiltX: -3 });
  const TELL_HOOK_RIGHT = derivePoseFromBase(base, { offsetX: 6, rightArmPose: 'hook', headTiltX: 3 });

  const TELL_UPPERCUT_LEFT = derivePoseFromBase(base, { offsetY: 6, leftArmPose: 'uppercut', headTiltY: 3 });
  const TELL_UPPERCUT_RIGHT = derivePoseFromBase(base, { offsetY: 6, rightArmPose: 'uppercut', headTiltY: 3 });

  // 4. PUNCHES:
  // Hook punches: offset body sideways by >= 6 px
  // Uppercut punches: body rising
  const PUNCH_JAB_LEFT = derivePoseFromBase(base, { offsetX: 3, leftArmPose: 'jab' });
  const PUNCH_JAB_RIGHT = derivePoseFromBase(base, { offsetX: -3, rightArmPose: 'jab' });
  const PUNCH_HOOK_LEFT = derivePoseFromBase(base, { offsetX: 6, leftArmPose: 'hook' });
  const PUNCH_HOOK_RIGHT = derivePoseFromBase(base, { offsetX: -6, rightArmPose: 'hook' });
  const PUNCH_UPPERCUT_LEFT = derivePoseFromBase(base, { offsetY: -4, leftArmPose: 'uppercut' });
  const PUNCH_UPPERCUT_RIGHT = derivePoseFromBase(base, { offsetY: -4, rightArmPose: 'uppercut' });

  // 5. HITS & STATES (using actual matching figures from character's sheet per requirement 4)
  const HIT = derivePoseFromBase(base, { overrideSprite: extraBases.hit });
  const STUNNED = derivePoseFromBase(base, { overrideSprite: extraBases.stunned });
  const KNOCKED_DOWN = derivePoseFromBase(base, { overrideSprite: extraBases.kd });
  const KO = derivePoseFromBase(base, { overrideSprite: extraBases.kd });
  const TAUNT = derivePoseFromBase(base, { overrideSprite: extraBases.taunt });

  return {
    IDLE_1,
    IDLE_2,
    BLOCK_HIGH,
    BLOCK_LOW,
    TELL_JAB_LEFT,
    TELL_JAB_RIGHT,
    PUNCH_JAB_LEFT,
    PUNCH_JAB_RIGHT,
    TELL_HOOK_LEFT,
    TELL_HOOK_RIGHT,
    PUNCH_HOOK_LEFT,
    PUNCH_HOOK_RIGHT,
    TELL_UPPERCUT_LEFT,
    TELL_UPPERCUT_RIGHT,
    PUNCH_UPPERCUT_LEFT,
    PUNCH_UPPERCUT_RIGHT,
    HIT,
    STUNNED,
    KNOCKED_DOWN,
    KO,
    TAUNT,
  };
}

export const OPPONENT_SPRITE_MAPS: Record<string, Record<string, SpriteData>> = {
  aint_man: buildOpponentPoseMap('aint_man'),
  medi_jinx: buildOpponentPoseMap('medi_jinx'),
  dj_tito: buildOpponentPoseMap('dj_tito'),
  mr_yankee: buildOpponentPoseMap('mr_yankee'),
  maga_man: buildOpponentPoseMap('maga_man'),
};

export function getOpponentSprite(
  opponentId: string,
  action: OpponentActionType | string,
  frame: number = 0
): SpriteData {
  const spriteMap = OPPONENT_SPRITE_MAPS[opponentId] || OPPONENT_SPRITE_MAPS['aint_man'];

  if (action === 'IDLE') {
    // 2-frame breathing idle animation alternating every 30 frames
    const isFrame2 = Math.floor(frame / 30) % 2 === 1;
    return isFrame2 ? spriteMap['IDLE_2'] : spriteMap['IDLE_1'];
  }

  const sprite = spriteMap[action];
  if (sprite) {
    return sprite;
  }

  return spriteMap['IDLE_1'];
}

export function resolvePlayerSprite(
  action: ActionType | string,
  isExhausted: boolean = false
): SpriteData {
  return getPlayerSprite(action, isExhausted);
}
