import { ActionType, OpponentActionType } from '../core/types';
import { SpriteData } from './sprites/types';
import { IDLE_BASE_AINT_MAN } from './sprites/generated/aint_man';
import { IDLE_BASE_MEDI_JINX } from './sprites/generated/medi_jinx';
import { IDLE_BASE_DJ_TITO } from './sprites/generated/dj_tito';
import { IDLE_BASE_MR_YANKEE } from './sprites/generated/mr_yankee';
import { IDLE_BASE_MAGA_MAN } from './sprites/generated/maga_man';
import { getPlayerSprite } from './sprites/player';

export const IDLE_BASES: Record<string, SpriteData> = {
  aint_man: IDLE_BASE_AINT_MAN,
  medi_jinx: IDLE_BASE_MEDI_JINX,
  dj_tito: IDLE_BASE_DJ_TITO,
  mr_yankee: IDLE_BASE_MR_YANKEE,
  maga_man: IDLE_BASE_MAGA_MAN,
};

// Overlay / modification helper to derive poses from the base idle frame
// options:
// - offsetY: shift entire body up or down (e.g. breathing, knockdown)
// - offsetX: shift entire body left/right
// - leftArmPose / rightArmPose: arm modifications
// - headTilt: shift head region
function derivePoseFromBase(
  base: SpriteData,
  options: {
    offsetY?: number;
    offsetX?: number;
    leftArmPose?: 'guard' | 'jab' | 'hook' | 'uppercut' | 'block_high' | 'block_low' | 'down';
    rightArmPose?: 'guard' | 'jab' | 'hook' | 'uppercut' | 'block_high' | 'block_low' | 'down';
    headTiltX?: number;
    headTiltY?: number;
    hitFlash?: boolean;
    knockdown?: boolean;
    taunt?: boolean;
  }
): SpriteData {
  const width = base.width;
  const height = base.height;
  const offsetY = options.offsetY ?? 0;
  const offsetX = options.offsetX ?? 0;
  const lPose = options.leftArmPose ?? 'guard';
  const rPose = options.rightArmPose ?? 'guard';
  const headX = options.headTiltX ?? 0;
  const headY = options.headTiltY ?? 0;

  // Clone palette
  const palette = { ...base.palette };
  // Find glove / outline color token if available, or first non-transparent token
  const tokens = Object.keys(palette).filter(k => k !== '.');
  const outlineToken = tokens[0] || '0';
  const gloveToken = tokens.find(k => [0x16, 0x26, 0x02, 0x28, 0x20].includes(palette[k])) || tokens[1] || '1';
  const highlightToken = tokens.find(k => [0x20, 0x38, 0x31, 0x27].includes(palette[k])) || tokens[2] || '2';

  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    const rowChars = new Array(width).fill('.');

    if (options.knockdown) {
      // Body collapsed downward
      const srcY = y - 40;
      if (srcY >= 0 && srcY < height) {
        const srcRow = base.rows[srcY];
        for (let x = 0; x < width; x++) {
          rowChars[x] = srcRow[x] || '.';
        }
      }
      rows.push(rowChars.join(''));
      continue;
    }

    // Source Y considering vertical shift and breathing
    let srcY = y - offsetY;

    // Apply head tilt in head region (top 35% of body)
    let isHead = false;
    if (y < Math.floor(height * 0.35)) {
      isHead = true;
      srcY -= headY;
    }

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

    // --- LEFT ARM / GLOVE OVERLAYS ---
    const leftArmMinY = Math.floor(height * 0.30);
    const leftArmMaxY = Math.floor(height * 0.70);
    const leftArmW = Math.floor(width * 0.28);

    if (lPose === 'jab') {
      // Left arm thrust forward & center (x: 10..width*0.45, y: 35%..55%)
      if (y >= Math.floor(height * 0.35) && y < Math.floor(height * 0.58)) {
        for (let x = 12; x < Math.floor(width * 0.48); x++) {
          rowChars[x] = (x > Math.floor(width * 0.35)) ? gloveToken : highlightToken;
        }
      }
    } else if (lPose === 'hook') {
      // Wide sweeping arm on left edge, raised high
      if (y >= Math.floor(height * 0.22) && y < Math.floor(height * 0.45)) {
        for (let x = 2; x < Math.floor(width * 0.32); x++) {
          rowChars[x] = (y < Math.floor(height * 0.32)) ? gloveToken : outlineToken;
        }
      }
    } else if (lPose === 'uppercut') {
      // Dropped low then rising
      if (y >= Math.floor(height * 0.50) && y < Math.floor(height * 0.78)) {
        for (let x = 8; x < Math.floor(width * 0.38); x++) {
          rowChars[x] = gloveToken;
        }
      }
    } else if (lPose === 'block_high') {
      // Raised high guarding face
      if (y >= Math.floor(height * 0.15) && y < Math.floor(height * 0.38)) {
        for (let x = Math.floor(width * 0.15); x < Math.floor(width * 0.38); x++) {
          rowChars[x] = gloveToken;
        }
      }
    } else if (lPose === 'block_low') {
      // Guarding lower torso
      if (y >= Math.floor(height * 0.45) && y < Math.floor(height * 0.65)) {
        for (let x = Math.floor(width * 0.18); x < Math.floor(width * 0.40); x++) {
          rowChars[x] = gloveToken;
        }
      }
    }

    // --- RIGHT ARM / GLOVE OVERLAYS ---
    if (rPose === 'jab') {
      // Right arm thrust forward & center
      if (y >= Math.floor(height * 0.35) && y < Math.floor(height * 0.58)) {
        for (let x = Math.floor(width * 0.52); x < width - 12; x++) {
          rowChars[x] = (x < Math.floor(width * 0.65)) ? gloveToken : highlightToken;
        }
      }
    } else if (rPose === 'hook') {
      // Wide sweeping hook on right edge, raised high
      if (y >= Math.floor(height * 0.22) && y < Math.floor(height * 0.45)) {
        for (let x = width - Math.floor(width * 0.32); x < width - 2; x++) {
          rowChars[x] = (y < Math.floor(height * 0.32)) ? gloveToken : outlineToken;
        }
      }
    } else if (rPose === 'uppercut') {
      // Dropped low then rising
      if (y >= Math.floor(height * 0.50) && y < Math.floor(height * 0.78)) {
        for (let x = Math.floor(width * 0.62); x < width - 8; x++) {
          rowChars[x] = gloveToken;
        }
      }
    } else if (rPose === 'block_high') {
      if (y >= Math.floor(height * 0.15) && y < Math.floor(height * 0.38)) {
        for (let x = Math.floor(width * 0.62); x < Math.floor(width * 0.85); x++) {
          rowChars[x] = gloveToken;
        }
      }
    } else if (rPose === 'block_low') {
      if (y >= Math.floor(height * 0.45) && y < Math.floor(height * 0.65)) {
        for (let x = Math.floor(width * 0.60); x < Math.floor(width * 0.82); x++) {
          rowChars[x] = gloveToken;
        }
      }
    }

    if (options.taunt) {
      // Both arms flexing outwards
      if (y >= Math.floor(height * 0.25) && y < Math.floor(height * 0.48)) {
        for (let x = 2; x < Math.floor(width * 0.22); x++) rowChars[x] = gloveToken;
        for (let x = width - Math.floor(width * 0.22); x < width - 2; x++) rowChars[x] = gloveToken;
      }
    }

    rows.push(rowChars.join(''));
  }

  return {
    width,
    height,
    palette,
    rows,
  };
}

// Build full pose mapping for an opponent
export function buildOpponentPoseMap(opponentId: string): Record<string, SpriteData> {
  const base = IDLE_BASES[opponentId] || IDLE_BASE_AINT_MAN;

  // IDLE_1: Resting idle
  const IDLE_1 = base;
  // IDLE_2: Breathing frame: 2px breathing offset differing by >= 20 pixels
  const IDLE_2 = derivePoseFromBase(base, { offsetY: 2, headTiltY: 1 });

  // BLOCK
  const BLOCK_HIGH = derivePoseFromBase(base, { leftArmPose: 'block_high', rightArmPose: 'block_high' });
  const BLOCK_LOW = derivePoseFromBase(base, { leftArmPose: 'block_low', rightArmPose: 'block_low' });

  // TELLS: distinct tell poses differing by >= 150 pixels from idle and from each other
  // Jab tell: pulls arm back and leans body
  const TELL_JAB_LEFT = derivePoseFromBase(base, { offsetX: -3, leftArmPose: 'jab', headTiltX: -2 });
  const TELL_JAB_RIGHT = derivePoseFromBase(base, { offsetX: 3, rightArmPose: 'jab', headTiltX: 2 });

  // Hook tell: lifts arm high and wide, body leans
  const TELL_HOOK_LEFT = derivePoseFromBase(base, { offsetX: -5, leftArmPose: 'hook', headTiltX: -3 });
  const TELL_HOOK_RIGHT = derivePoseFromBase(base, { offsetX: 5, rightArmPose: 'hook', headTiltX: 3 });

  // Uppercut tell: drops low and crouches body down by 6px
  const TELL_UPPERCUT_LEFT = derivePoseFromBase(base, { offsetY: 5, leftArmPose: 'uppercut', headTiltY: 3 });
  const TELL_UPPERCUT_RIGHT = derivePoseFromBase(base, { offsetY: 5, rightArmPose: 'uppercut', headTiltY: 3 });

  // PUNCHES
  const PUNCH_JAB_LEFT = derivePoseFromBase(base, { offsetX: 3, leftArmPose: 'jab' });
  const PUNCH_JAB_RIGHT = derivePoseFromBase(base, { offsetX: -3, rightArmPose: 'jab' });
  const PUNCH_HOOK_LEFT = derivePoseFromBase(base, { offsetX: 6, leftArmPose: 'hook' });
  const PUNCH_HOOK_RIGHT = derivePoseFromBase(base, { offsetX: -6, rightArmPose: 'hook' });
  const PUNCH_UPPERCUT_LEFT = derivePoseFromBase(base, { offsetY: -4, leftArmPose: 'uppercut' });
  const PUNCH_UPPERCUT_RIGHT = derivePoseFromBase(base, { offsetY: -4, rightArmPose: 'uppercut' });

  // HITS & STATES
  const HIT = derivePoseFromBase(base, { headTiltX: 6, headTiltY: -3, offsetX: 3 });
  const STUNNED = derivePoseFromBase(base, { headTiltX: -4, headTiltY: 4, offsetX: -2 });
  const KNOCKED_DOWN = derivePoseFromBase(base, { knockdown: true });
  const KO = derivePoseFromBase(base, { knockdown: true });
  const TAUNT = derivePoseFromBase(base, { taunt: true });

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
    // 2-frame breathing idle animation alternating every 30 frames (0.5s at 60fps)
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
