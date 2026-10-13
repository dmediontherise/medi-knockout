import { ActionType, OpponentActionType } from '../core/types';
import { SpriteData, mirrorSprite } from './sprites/types';
import { IDLE_BASE_AINT_MAN, AINT_MAN_FRAMES } from './sprites/generated/aint_man';
import { IDLE_BASE_MEDI_JINX, MEDI_JINX_FRAMES } from './sprites/generated/medi_jinx';
import { IDLE_BASE_DJ_TITO, DJ_TITO_FRAMES } from './sprites/generated/dj_tito';
import { IDLE_BASE_MR_YANKEE, MR_YANKEE_FRAMES } from './sprites/generated/mr_yankee';
import { IDLE_BASE_MAGA_MAN, MAGA_MAN_FRAMES } from './sprites/generated/maga_man';
import { getPlayerSprite, resolvePlayerFrame, PLAYER_BACK_IDLE } from './sprites/player';
import { toFlashPalette, toDarkPalette } from './nesPalette';

export { PLAYER_BACK_IDLE, resolvePlayerFrame };

export const IDLE_BASES: Record<string, SpriteData> = {
  aint_man: IDLE_BASE_AINT_MAN,
  medi_jinx: IDLE_BASE_MEDI_JINX,
  dj_tito: IDLE_BASE_DJ_TITO,
  mr_yankee: IDLE_BASE_MR_YANKEE,
  maga_man: IDLE_BASE_MAGA_MAN,
};

export const OPPONENT_FRAME_MAPS: Record<string, Record<number | string, SpriteData>> = {
  aint_man: AINT_MAN_FRAMES,
  medi_jinx: MEDI_JINX_FRAMES,
  dj_tito: DJ_TITO_FRAMES,
  mr_yankee: MR_YANKEE_FRAMES,
  maga_man: MAGA_MAN_FRAMES,
};

// Action to figure index per Task 012 action -> figure map
export const OPPONENT_ACTION_FIGURES: Record<string, Record<string, number | string>> = {
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

export type PaletteEffect = 'normal' | 'flash' | 'dark';
export type VisualEffect = 'none' | 'spark-head' | 'spark-body' | 'stars';

export interface PoseTransform {
  dx: number;
  dy: number;
  flipX: boolean;
  palette: PaletteEffect;
  effect: VisualEffect;
  shake: number;
  fall: boolean;
}

// Transform table per requirement 1 & 5
export const OPPONENT_POSES: Record<OpponentActionType | string, PoseTransform> = {
  IDLE: {
    dx: 0,
    dy: 0,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  BLOCK_HIGH: {
    dx: 0,
    dy: -2,
    flipX: false,
    palette: 'normal',
    effect: 'spark-head',
    shake: 0,
    fall: false,
  },
  BLOCK_LOW: {
    dx: 0,
    dy: -2,
    flipX: false,
    palette: 'normal',
    effect: 'spark-body',
    shake: 0,
    fall: false,
  },
  TELL_JAB_LEFT: {
    dx: -4,
    dy: -4,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_JAB_RIGHT: {
    dx: 4,
    dy: -4,
    flipX: true,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_HOOK_LEFT: {
    dx: -16,
    dy: -2,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_HOOK_RIGHT: {
    dx: 16,
    dy: -2,
    flipX: true,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_UPPERCUT_LEFT: {
    dx: -3,
    dy: 14,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_UPPERCUT_RIGHT: {
    dx: 3,
    dy: 14,
    flipX: true,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_JAB_LEFT: {
    dx: -6,
    dy: 6,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_JAB_RIGHT: {
    dx: 6,
    dy: 6,
    flipX: true,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_HOOK_LEFT: {
    dx: -10,
    dy: 6,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_HOOK_RIGHT: {
    dx: 10,
    dy: 6,
    flipX: true,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_UPPERCUT_LEFT: {
    dx: -4,
    dy: 4,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  PUNCH_UPPERCUT_RIGHT: {
    dx: 4,
    dy: 4,
    flipX: true,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  HIT: {
    dx: 4,
    dy: -2,
    flipX: false,
    palette: 'flash',
    effect: 'spark-head',
    shake: 4,
    fall: false,
  },
  STUNNED: {
    dx: 0,
    dy: 0,
    flipX: false,
    palette: 'normal',
    effect: 'stars',
    shake: 2,
    fall: false,
  },
  KNOCKED_DOWN: {
    dx: 0,
    dy: 0,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  KO: {
    dx: 0,
    dy: 0,
    flipX: false,
    palette: 'normal',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TAUNT: {
    dx: 0,
    dy: -4,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
};

// Player pose transforms
export interface PlayerPoseTransform {
  dx: number;
  dy: number;
  palette: PaletteEffect;
  shake: number;
  fall: boolean;
}

export const PLAYER_POSES: Record<ActionType | string, PlayerPoseTransform> = {
  IDLE: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  DODGE_LEFT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  DODGE_RIGHT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  DUCK: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  BLOCK: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  JAB_LEFT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  JAB_RIGHT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  PUNCH_LEFT_HEAD: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  PUNCH_RIGHT_HEAD: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  PUNCH_LEFT_BODY: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  PUNCH_RIGHT_BODY: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  HOOK_LEFT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  HOOK_RIGHT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  UPPERCUT: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  STAR_PUNCH: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  HIT: { dx: 0, dy: 0, palette: 'normal', shake: 2, fall: false },
  KNOCKED_DOWN: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  KO: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
};

// Helper to apply palette effect ('flash' or 'dark') to a sprite
export function applyPaletteEffect(sprite: SpriteData, effect: PaletteEffect): SpriteData {
  if (effect === 'normal') return sprite;
  const newPalette: Record<string, number> = {};
  for (const [k, v] of Object.entries(sprite.palette)) {
    if (v === -1) {
      newPalette[k] = -1;
    } else if (effect === 'flash') {
      newPalette[k] = toFlashPalette(v);
    } else if (effect === 'dark') {
      newPalette[k] = toDarkPalette(v);
    }
  }
  return {
    width: sprite.width,
    height: sprite.height,
    palette: newPalette,
    rows: sprite.rows,
  };
}

export interface OpponentAnchor {
  headCenterX: number;
  centerOpaqueX: number;
  lastRow: number;
}

const anchorCache = new WeakMap<SpriteData, OpponentAnchor>();

export function getSpriteAnchor(sprite: SpriteData): OpponentAnchor {
  const cached = anchorCache.get(sprite);
  if (cached) return cached;

  const top25Rows = Math.floor(sprite.height * 0.25);
  let sumTopX = 0;
  let countTop = 0;
  for (let y = 0; y < top25Rows; y++) {
    const row = sprite.rows[y];
    for (let x = 0; x < sprite.width; x++) {
      if (row[x] !== '.' && row[x] !== ' ') {
        sumTopX += x;
        countTop++;
      }
    }
  }
  const headCenterX = countTop > 0 ? (sumTopX / countTop) : (sprite.width / 2);

  let sumAllX = 0;
  let countAll = 0;
  let lastRow = -1;
  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.rows[y];
    for (let x = 0; x < sprite.width; x++) {
      if (row[x] !== '.' && row[x] !== ' ') {
        sumAllX += x;
        countAll++;
        if (y > lastRow) lastRow = y;
      }
    }
  }
  const centerOpaqueX = countAll > 0 ? (sumAllX / countAll) : (sprite.width / 2);

  const anchor: OpponentAnchor = {
    headCenterX,
    centerOpaqueX,
    lastRow: lastRow >= 0 ? lastRow : sprite.height - 1,
  };
  anchorCache.set(sprite, anchor);
  return anchor;
}

export function getOpponentSprite(
  opponentId: string,
  action: OpponentActionType | string,
  actionFrame: number = 0
): SpriteData {
  const charId = OPPONENT_FRAME_MAPS[opponentId] ? opponentId : 'aint_man';
  const frames = OPPONENT_FRAME_MAPS[charId];
  const figMap = OPPONENT_ACTION_FIGURES[charId] || OPPONENT_ACTION_FIGURES['aint_man'];
  const transform = OPPONENT_POSES[action] || OPPONENT_POSES['IDLE'];

  // Determine base action key
  const isRight = action.endsWith('_RIGHT');
  let baseActionKey = action;
  if (isRight) {
    baseActionKey = action.replace('_RIGHT', '');
  } else if (action.endsWith('_LEFT')) {
    baseActionKey = action.replace('_LEFT', '');
  }

  // Knockdown / KO frame logic:
  // On actionFrame 0-9, draw the HIT frame
  // From actionFrame 10 on, draw the lying frame
  let figKey: number | string;
  if (action === 'KNOCKED_DOWN' || action === 'KO') {
    if (actionFrame < 10) {
      figKey = figMap['HIT'] ?? 2;
    } else {
      figKey = figMap['KNOCKED_DOWN'] ?? 'LIE';
    }
  } else {
    figKey = figMap[baseActionKey] ?? figMap[action] ?? 0;
  }

  const baseSprite = frames[figKey] || frames[0] || IDLE_BASES[charId];

  // Flashing windows based on actionFrame
  let activePalette = transform.palette;
  if (action === 'TELL_JAB_LEFT' || action === 'TELL_JAB_RIGHT') {
    // Flash on actionFrame 0-3, 8-11 and 16-19
    const isFlashWindow =
      (actionFrame >= 0 && actionFrame <= 3) ||
      (actionFrame >= 8 && actionFrame <= 11) ||
      (actionFrame >= 16 && actionFrame <= 19);
    activePalette = isFlashWindow ? 'flash' : 'normal';
  } else if (action === 'HIT') {
    // Flash on actionFrame 0-3 only, then normal palette
    activePalette = (actionFrame >= 0 && actionFrame <= 3) ? 'flash' : 'normal';
  } else if (action === 'KNOCKED_DOWN' || action === 'KO') {
    // Flash on actionFrame 0-3 of HIT frame
    activePalette = (actionFrame <= 3) ? 'flash' : 'normal';
  }

  // Horizontal flip for _RIGHT
  let sprite = (isRight || transform.flipX) ? mirrorSprite(baseSprite) : baseSprite;

  // Palette effect
  if (activePalette !== 'normal') {
    sprite = applyPaletteEffect(sprite, activePalette);
  }

  return sprite;
}

export function resolvePlayerSprite(
  action: ActionType | string,
  isExhausted: boolean = false
): SpriteData {
  return getPlayerSprite(action, isExhausted);
}

// For unit testing and backward compatibility
export const OPPONENT_SPRITE_MAPS: Record<string, Record<string, SpriteData>> = {
  aint_man: buildStaticSpriteMap('aint_man'),
  medi_jinx: buildStaticSpriteMap('medi_jinx'),
  dj_tito: buildStaticSpriteMap('dj_tito'),
  mr_yankee: buildStaticSpriteMap('mr_yankee'),
  maga_man: buildStaticSpriteMap('maga_man'),
};

function buildStaticSpriteMap(id: string): Record<string, SpriteData> {
  const map: Record<string, SpriteData> = {};
  for (const act of Object.keys(OPPONENT_POSES)) {
    map[act] = getOpponentSprite(id, act, 0);
  }
  // Breathing frame IDLE_2: offset torso/breathing
  map['IDLE_1'] = getOpponentSprite(id, 'IDLE', 0);
  map['IDLE_2'] = getOpponentSprite(id, 'IDLE', 30);
  return map;
}
