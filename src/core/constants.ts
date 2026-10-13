import { RosterOpponentSpec } from './types';

// Timing constants in integer frames (at 60 FPS)
export const FPS = 60;

// Player Frame Timings
export const PLAYER_DURATIONS = {
  PUNCH: 14,             // 14 frames total punch animation
  PUNCH_ACTIVE_START: 4, // Frame punch can connect
  PUNCH_ACTIVE_END: 6,
  STAR_PUNCH: 22,
  STAR_PUNCH_ACTIVE_START: 8,
  STAR_PUNCH_ACTIVE_END: 12,
  DODGE: 22,             // 22 frames dodge
  DODGE_INVULN_START: 2,
  DODGE_INVULN_END: 18,
  DUCK: 20,              // 20 frames duck
  DUCK_INVULN_START: 2,
  DUCK_INVULN_END: 16,
  BLOCK_MIN: 10,
  HIT: 16,
  KNOCKED_DOWN: 60,
  KO: 180,
};

// Opponent Move Constants
export const OPPONENT_ATTACKS = {
  JAB: {
    damage: 10,
    baseTell: 24,       // >= 12 frames
    activeFrames: 8,
    recoveryFrames: 18,
  },
  HOOK: {
    damage: 18,
    baseTell: 36,       // >= 12 frames
    activeFrames: 10,
    recoveryFrames: 22,
  },
  UPPERCUT: {
    damage: 30,
    baseTell: 50,       // >= 12 frames
    activeFrames: 12,
    recoveryFrames: 28,
  },
};

export const OPPONENT_DURATIONS = {
  BLOCK: 30,
  HIT: 16,
  STUNNED: 60,
  KNOCKED_DOWN: 60,
  KO: 180,
};

// Hearts and Exhaustion
export const HEARTS = {
  HIT_PENALTY: 3,         // Hit taken: -3 hearts
  BLOCKED_PENALTY: 1,     // Punch blocked: -1 heart
  DEFEND_BLOCK_PENALTY: 1,// Blocking an attack: -1 heart
  PUNCH_LANDED_BONUS: 1,  // Landing a punch: +1 heart
  EVADE_RECOVERY: 1,      // Successful dodge/duck while exhausted: +1 heart
  EXHAUSTION_RECOVERY_THRESHOLD: 3, // Once hearts reach this, punching is re-enabled
};

// Stars & Combat Damage
export const STARS = {
  MAX_STARS: 3,
  STAR_PUNCH_DAMAGE: 45,
  CONSUMPTION: 1,
};

export const COMBAT = {
  PLAYER_BODY_DAMAGE: 6,
  PLAYER_HEAD_DAMAGE: 10,
  COUNTER_MULTIPLIER: 2.0,
  STUNNED_MULTIPLIER: 1.2,
  BLOCK_CHIP_FACTOR: 0.15,
};

// Referee and Knockdowns
export const REFEREE = {
  FRAMES_PER_COUNT: 45,    // 45 frames (~0.75s) per count tick
  MAX_COUNT: 10,
  MASHES_NEEDED_BASE: 12,  // Mash inputs to get up
  MAX_KNOCKDOWNS_PER_ROUND_TKO: 3,
};

// Rounds and Clock
export const ROUNDS = {
  TOTAL_ROUNDS: 3,
  ROUND_DURATION_GAME_SECONDS: 180, // 3:00
  GAME_CLOCK_SCALE: 1,             // 1 game second per 60 frames
  FRAMES_PER_GAME_SECOND: 60,
  BETWEEN_ROUND_FRAMES: 180,       // 3 seconds pause between rounds
  BETWEEN_ROUND_MIN_FRAMES: 60,   // Minimum 60 frames before START can advance
  BETWEEN_ROUND_HEAL_RATIO: 0.4,   // regain 40% of max HP
};

// Points
export const POINTS = {
  JAB_LANDED: 40,
  BODY_LANDED: 30,
  COUNTER_LANDED: 100,
  STAR_PUNCH_LANDED: 300,
  KNOCKDOWN_OPPONENT: 500,
};

// Roster Specs (preserves the 5 characters and specials)
export const ROSTER_SPECS: Record<string, RosterOpponentSpec> = {
  aint_man: {
    id: 'aint_man',
    name: 'AINT MAN',
    description: 'The Gold Standard. Balanced and tough.',
    maxHp: 200,
    initialHearts: 12,
    power: 1.0,
    speed: 1.0,
    baseTells: { JAB: 26, HOOK: 38, UPPERCUT: 52 },
    combos: [
      ['JAB_LEFT', 'JAB_RIGHT'],
      ['JAB_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT'], // BOUNTYGATE
      ['HOOK_LEFT', 'HOOK_RIGHT'],
    ],
    specialId: 'bountygate',
  },
  medi_jinx: {
    id: 'medi_jinx',
    name: 'MEDI JINX',
    description: 'Fast, annoying, and mischievous.',
    maxHp: 150,
    initialHearts: 10,
    power: 0.8,
    speed: 0.8,
    baseTells: { JAB: 20, HOOK: 30, UPPERCUT: 42 },
    combos: [
      ['JAB_LEFT', 'JAB_RIGHT', 'HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT'],
      ['JAB_LEFT', 'JAB_LEFT', 'HOOK_RIGHT'],
    ],
    specialId: 'book_it',
  },
  dj_tito: {
    id: 'dj_tito',
    name: 'DJ TITO',
    description: 'Rhythm-based counter puncher.',
    maxHp: 180,
    initialHearts: 14,
    power: 1.0,
    speed: 1.1,
    baseTells: { JAB: 28, HOOK: 40, UPPERCUT: 54 },
    combos: [
      ['JAB_LEFT', 'HOOK_RIGHT', 'HOOK_LEFT', 'UPPERCUT_RIGHT'],
      ['HOOK_LEFT', 'HOOK_RIGHT'],
    ],
    specialId: 'run_it_back',
  },
  mr_yankee: {
    id: 'mr_yankee',
    name: 'MR. YANKEE',
    description: 'Slow but hits like a truck.',
    maxHp: 250,
    initialHearts: 16,
    power: 1.4,
    speed: 1.3,
    baseTells: { JAB: 34, HOOK: 46, UPPERCUT: 60 },
    combos: [
      ['HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT', 'UPPERCUT_RIGHT', 'HOOK_LEFT'], // PINSTRIPE
      ['UPPERCUT_RIGHT'],
    ],
    specialId: 'pinstripe',
  },
  maga_man: {
    id: 'maga_man',
    name: 'MAGA MAN',
    description: 'Brawler with wild swings.',
    maxHp: 220,
    initialHearts: 15,
    power: 1.1,
    speed: 1.0,
    baseTells: { JAB: 26, HOOK: 36, UPPERCUT: 50 },
    combos: [
      ['BLOCK_HIGH', 'BLOCK_LOW', 'JAB_RIGHT', 'JAB_RIGHT'],
      ['HOOK_RIGHT', 'UPPERCUT_LEFT'],
    ],
    specialId: 'big_lie',
  },
};
