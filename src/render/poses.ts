import { ActionType, OpponentActionType } from '../core/types';
import { SpriteData, mirrorSprite } from './sprites/types';
import { IDLE_BASE_AINT_MAN } from './sprites/generated/aint_man';
import { IDLE_BASE_MEDI_JINX } from './sprites/generated/medi_jinx';
import { IDLE_BASE_DJ_TITO } from './sprites/generated/dj_tito';
import { IDLE_BASE_MR_YANKEE } from './sprites/generated/mr_yankee';
import { IDLE_BASE_MAGA_MAN } from './sprites/generated/maga_man';
import { getPlayerSprite, PLAYER_BACK_IDLE } from './sprites/player';
import { toFlashPalette, toDarkPalette } from './nesPalette';

export { PLAYER_BACK_IDLE };

export const IDLE_BASES: Record<string, SpriteData> = {
  aint_man: IDLE_BASE_AINT_MAN,
  medi_jinx: IDLE_BASE_MEDI_JINX,
  dj_tito: IDLE_BASE_DJ_TITO,
  mr_yankee: IDLE_BASE_MR_YANKEE,
  maga_man: IDLE_BASE_MAGA_MAN,
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

// Transform table per requirement 1
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
  // Tells:
  // - Jab tell: pull-back dy <= -3 and 'flash' palette on alternating 4-frame windows
  // - Hook tell: lean |dx| >= 10 toward the hook side, plus flash
  // - Uppercut tell: crouch dy >= 8, plus flash
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
    dx: -12,
    dy: -2,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_HOOK_RIGHT: {
    dx: 12,
    dy: -2,
    flipX: true,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_UPPERCUT_LEFT: {
    dx: -3,
    dy: 10,
    flipX: false,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  TELL_UPPERCUT_RIGHT: {
    dx: 3,
    dy: 10,
    flipX: true,
    palette: 'flash',
    effect: 'none',
    shake: 0,
    fall: false,
  },
  // Punches:
  // lunge toward camera side: dy >= 4, dx toward punch side
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
  // Hits & States:
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
    palette: 'dark',
    effect: 'none',
    shake: 0,
    fall: true,
  },
  KO: {
    dx: 0,
    dy: 0,
    flipX: false,
    palette: 'dark',
    effect: 'none',
    shake: 0,
    fall: true,
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

// Player pose transforms per requirement 7
export interface PlayerPoseTransform {
  dx: number;
  dy: number;
  palette: PaletteEffect;
  shake: number;
  fall: boolean;
}

export const PLAYER_POSES: Record<ActionType | string, PlayerPoseTransform> = {
  IDLE: { dx: 0, dy: 0, palette: 'normal', shake: 0, fall: false },
  DODGE_LEFT: { dx: -24, dy: 0, palette: 'normal', shake: 0, fall: false },
  DODGE_RIGHT: { dx: 24, dy: 0, palette: 'normal', shake: 0, fall: false },
  DUCK: { dx: 0, dy: 12, palette: 'normal', shake: 0, fall: false },
  BLOCK: { dx: 0, dy: -2, palette: 'dark', shake: 0, fall: false },
  JAB_LEFT: { dx: -6, dy: -8, palette: 'normal', shake: 0, fall: false },
  JAB_RIGHT: { dx: 6, dy: -8, palette: 'normal', shake: 0, fall: false },
  PUNCH_LEFT_HEAD: { dx: -6, dy: -8, palette: 'normal', shake: 0, fall: false },
  PUNCH_RIGHT_HEAD: { dx: 6, dy: -8, palette: 'normal', shake: 0, fall: false },
  PUNCH_LEFT_BODY: { dx: -6, dy: -3, palette: 'normal', shake: 0, fall: false },
  PUNCH_RIGHT_BODY: { dx: 6, dy: -3, palette: 'normal', shake: 0, fall: false },
  HOOK_LEFT: { dx: -6, dy: -5, palette: 'normal', shake: 0, fall: false },
  HOOK_RIGHT: { dx: 6, dy: -5, palette: 'normal', shake: 0, fall: false },
  UPPERCUT: { dx: 0, dy: -10, palette: 'normal', shake: 0, fall: false },
  STAR_PUNCH: { dx: 0, dy: -12, palette: 'flash', shake: 0, fall: false },
  HIT: { dx: 2, dy: 2, palette: 'flash', shake: 3, fall: false },
  KNOCKED_DOWN: { dx: 0, dy: 0, palette: 'dark', shake: 0, fall: true },
  KO: { dx: 0, dy: 0, palette: 'dark', shake: 0, fall: true },
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

export function getOpponentSprite(
  opponentId: string,
  action: OpponentActionType | string,
  frame: number = 0
): SpriteData {
  const base = IDLE_BASES[opponentId] || IDLE_BASES['aint_man'];
  const transform = OPPONENT_POSES[action] || OPPONENT_POSES['IDLE'];

  // Flashing windows for jab tell or taunt: alternate 4-frame windows
  let activePalette = transform.palette;
  if (action === 'TELL_JAB_LEFT' || action === 'TELL_JAB_RIGHT') {
    const isFlashWindow = Math.floor(frame / 4) % 2 === 0;
    activePalette = isFlashWindow ? 'flash' : 'normal';
  } else if (action === 'HIT') {
    // Flash for first 4 frames
    activePalette = (frame % 8 < 4) ? 'flash' : 'normal';
  }

  // Horizontal flip
  let sprite = transform.flipX ? mirrorSprite(base) : base;

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
