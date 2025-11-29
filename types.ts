
export enum GameState {
  MENU,
  ENTRANCE,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export type HitType = 'HEAD' | 'BODY' | 'NONE';

export enum PlayerAction {
  IDLE = 'IDLE',
  BLOCK = 'BLOCK',
  DODGE_LEFT = 'DODGE_LEFT',
  DODGE_RIGHT = 'DODGE_RIGHT',
  PUNCH_LEFT_BODY = 'PUNCH_LEFT_BODY',
  PUNCH_RIGHT_BODY = 'PUNCH_RIGHT_BODY',
  PUNCH_LEFT_HEAD = 'PUNCH_LEFT_HEAD',
  PUNCH_RIGHT_HEAD = 'PUNCH_RIGHT_HEAD',
  HIT = 'HIT',
  KO = 'KO'
}

export enum OpponentAction {
  IDLE = 'IDLE',
  BLOCK_HIGH = 'BLOCK_HIGH',
  BLOCK_LOW = 'BLOCK_LOW',
  TELEGRAPH_JAB_LEFT = 'TELEGRAPH_JAB_LEFT',
  TELEGRAPH_JAB_RIGHT = 'TELEGRAPH_JAB_RIGHT',
  TELEGRAPH_HOOK_LEFT = 'TELEGRAPH_HOOK_LEFT',
  TELEGRAPH_HOOK_RIGHT = 'TELEGRAPH_HOOK_RIGHT',
  TELEGRAPH_UPPERCUT_LEFT = 'TELEGRAPH_UPPERCUT_LEFT',
  TELEGRAPH_UPPERCUT_RIGHT = 'TELEGRAPH_UPPERCUT_RIGHT',
  PUNCH_JAB_LEFT = 'PUNCH_JAB_LEFT',
  PUNCH_JAB_RIGHT = 'PUNCH_JAB_RIGHT',
  PUNCH_HOOK_LEFT = 'PUNCH_HOOK_LEFT',
  PUNCH_HOOK_RIGHT = 'PUNCH_HOOK_RIGHT',
  PUNCH_UPPERCUT_LEFT = 'PUNCH_UPPERCUT_LEFT',
  PUNCH_UPPERCUT_RIGHT = 'PUNCH_UPPERCUT_RIGHT',
  HIT = 'HIT',
  STUNNED = 'STUNNED',
  KO = 'KO'
}

export interface FighterStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  superMeter: number;
}

// Sprite frame coordinates [x, y] in pixels or index
export interface SpriteConfig {
  sheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  // Map actions to grid coordinates [col, row]
  frames: {
    IDLE: [number, number];
    BLOCK: [number, number];
    HIT: [number, number];
    KO: [number, number];
    PUNCH_JAB: [number, number];
    PUNCH_HOOK: [number, number];
    PUNCH_UPPERCUT: [number, number];
    WIN?: [number, number];
  };
}

export interface OpponentCharacter {
  id: string;
  name: string;
  description: string;
  stats: {
    maxHp: number;
    power: number; // Damage multiplier
    speed: number; // Speed multiplier (lower is faster)
  };
  spriteConfig: SpriteConfig;
  aiPatternOverride?: string[]; // Specific combo preference
}
