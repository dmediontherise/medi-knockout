
import { OpponentCharacter } from './types';

export const PLAYER_MAX_HP = 100;
export const STAMINA_REGEN = 0.8; 
export const PUNCH_STAMINA_COST = 12;
export const PUNCH_DAMAGE_BODY = 6;
export const PUNCH_DAMAGE_HEAD = 10;
export const COUNTER_MULTIPLIER = 2.0;
export const MAX_PLAYER_COMBO = 5; // Max hits before AI forces a break

// Timing in milliseconds
export const ACTION_DURATION = {
  PUNCH: 120, 
  DODGE: 250,
  BLOCK: 150, 
  HIT: 120,
  STUNNED: 1500,
  KO: 3000, 
};

export const OPPONENT_MOVES = {
  JAB: { damage: 8, telegraph: 450, duration: 200 }, 
  HOOK: { damage: 15, telegraph: 700, duration: 300 }, 
  UPPERCUT: { damage: 25, telegraph: 1100, duration: 400 }, 
  BLOCK: { duration: 600 },
};

export const AI_SETTINGS = {
  RECOVERY_BASE: 400, // Reduced from 1000 for more aggression
  COMBO_INTERVAL: 80, // Faster chain attacks
  REFLEX_BLOCK_CHANCE: 0.6, // Higher chance to block spam
};

export const AI_PATTERNS = {
  BASIC_ONE_TWO: ['JAB_LEFT', 'JAB_RIGHT'],
  HOOK_COMBO: ['HOOK_LEFT', 'HOOK_RIGHT'],
  THE_CRUSHER: ['HOOK_RIGHT', 'UPPERCUT_LEFT'],
  SPEED_TEST: ['JAB_LEFT', 'JAB_LEFT', 'HOOK_RIGHT'],
  HAYMAKER: ['UPPERCUT_RIGHT'], 
  
  // Character Specials
  // Aint Man: Bountygate (3 punch combo)
  BOUNTYGATE: ['JAB_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT'],
  
  // Mr. Yankee: Pinstripe Punches (5 hit combo)
  PINSTRIPE_PUNCHES: ['HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT', 'UPPERCUT_RIGHT', 'HOOK_LEFT'],

  // Default fallbacks
  THE_28_3_CHOKE: ['JAB_LEFT', 'JAB_RIGHT', 'HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT'], 
  THE_BEAT_DROP: ['JAB_LEFT', 'HOOK_RIGHT', 'HOOK_LEFT', 'UPPERCUT_RIGHT'], 
  THE_WALL: ['BLOCK_HIGH', 'BLOCK_LOW', 'JAB_RIGHT', 'JAB_RIGHT'], 
};

export const SPECIAL_STATS = {
  RUN_IT_BACK_DURATION: 20000, // DJ Tito: Inverted controls
  BIG_LIE_DURATION: 10000,     // MAGA Man: Self-harm mode
  BIG_LIE_DMG_MULT: 3.0,
  BOOK_IT_DMG_MULT: 2.0,       // Medi Jinx
  BOOK_IT_SPEED: 0.4,          // 40% duration (Very fast)
  PINSTRIPE_DMG_MULT: 2.0,     // Mr Yankee
}

// Procedural Roster - No images needed
export const ROSTER: OpponentCharacter[] = [
  {
    id: 'aint_man',
    name: "AINT MAN",
    description: "The Gold Standard. Balanced and tough.",
    stats: { maxHp: 200, power: 1.0, speed: 1.0 },
    spriteConfig: { sheetUrl: "assets/aint_man.jpg", frameWidth: 64, frameHeight: 64, scale: 6, frames: { IDLE:[0,0], BLOCK:[0,0], HIT:[0,0], KO:[0,0], PUNCH_JAB:[0,0], PUNCH_HOOK:[0,0], PUNCH_UPPERCUT:[0,0] } },
    aiPatternOverride: AI_PATTERNS.BASIC_ONE_TWO
  },
  {
    id: 'medi_jinx',
    name: "MEDI JINX",
    description: "Fast, annoying, and mischievous.",
    stats: { maxHp: 150, power: 0.8, speed: 0.8 }, 
    spriteConfig: { sheetUrl: "assets/medi_jinx.jpg", frameWidth: 64, frameHeight: 64, scale: 6, frames: { IDLE:[0,0], BLOCK:[0,0], HIT:[0,0], KO:[0,0], PUNCH_JAB:[0,0], PUNCH_HOOK:[0,0], PUNCH_UPPERCUT:[0,0] } },
    aiPatternOverride: AI_PATTERNS.THE_28_3_CHOKE
  },
  {
    id: 'dj_tito',
    name: "DJ TITO",
    description: "Rhythm-based counter puncher.",
    stats: { maxHp: 180, power: 1.0, speed: 1.1 },
    spriteConfig: { sheetUrl: "assets/dj_tito.jpg", frameWidth: 64, frameHeight: 64, scale: 6, frames: { IDLE:[0,0], BLOCK:[0,0], HIT:[0,0], KO:[0,0], PUNCH_JAB:[0,0], PUNCH_HOOK:[0,0], PUNCH_UPPERCUT:[0,0] } },
    aiPatternOverride: AI_PATTERNS.THE_BEAT_DROP
  },
  {
    id: 'mr_yankee',
    name: "MR. YANKEE",
    description: "Slow but hits like a truck.",
    stats: { maxHp: 250, power: 1.4, speed: 1.3 },
    spriteConfig: { sheetUrl: "assets/mr_yankee.jpg", frameWidth: 64, frameHeight: 64, scale: 6, frames: { IDLE:[0,0], BLOCK:[0,0], HIT:[0,0], KO:[0,0], PUNCH_JAB:[0,0], PUNCH_HOOK:[0,0], PUNCH_UPPERCUT:[0,0] } },
    aiPatternOverride: AI_PATTERNS.PINSTRIPE_PUNCHES
  },
  {
    id: 'maga_man',
    name: "MAGA MAN",
    description: "Brawler with wild swings.",
    stats: { maxHp: 220, power: 1.1, speed: 1.0 },
    spriteConfig: { sheetUrl: "assets/maga_man.jpg", frameWidth: 64, frameHeight: 64, scale: 6, frames: { IDLE:[0,0], BLOCK:[0,0], HIT:[0,0], KO:[0,0], PUNCH_JAB:[0,0], PUNCH_HOOK:[0,0], PUNCH_UPPERCUT:[0,0] } },
    aiPatternOverride: AI_PATTERNS.THE_WALL
  }
];
