import { SpriteData } from './types';
import { PLAYER_BACK_IDLE } from './playerBack';
import {
  PLAYER_FRAMES,
  PLAYER_ANCHORS,
  PLAYER_IDLE_A,
  PLAYER_IDLE_B,
} from './generated/player';
import { toFlashPalette } from '../nesPalette';

export { PLAYER_BACK_IDLE };

// Exhausted pink palette mapping: S, K, L, R, H, G mapped to pink/rose entries
export function getExhaustedPlayerPalette(basePalette: Record<string, number>): Record<string, number> {
  const pal = { ...basePalette };
  pal['S'] = 0x25; // Pink skin
  pal['K'] = 0x15; // Dark rose shadow
  pal['L'] = 0x35; // Light pink highlight
  pal['R'] = 0x25; // Pink gloves
  pal['H'] = 0x35;
  pal['G'] = 0x15;
  return pal;
}

export interface PlayerFrameResolution {
  frameName: string;
  sprite: SpriteData;
  anchorX: number;
}

/**
 * Maps player situation to the exact frame per Task 014 Requirement 2:
 *
 * | Situation | Frame |
 * | `IDLE` | IDLE_A / IDLE_B, alternating every 16 global frames |
 * | `PUNCH_LEFT_HEAD`, frames 0-3 | JAB_L_WIND |
 * | `PUNCH_LEFT_HEAD`, frames 4-8 | JAB_L_HIT |
 * | `PUNCH_LEFT_HEAD`, frames 9+ | JAB_L_BACK |
 * | `PUNCH_RIGHT_HEAD` | The same pattern with the R frames |
 * | `PUNCH_*_BODY` | The BODY frames, in the same pattern |
 * | `STAR_PUNCH`, frames 0-7 | STAR_WIND |
 * | `STAR_PUNCH`, frames 8-15 | STAR_HIT |
 * | `STAR_PUNCH`, frames 16+ | STAR_BACK |
 * | `DODGE_LEFT`, frames 0-3 and 18+ | DODGE_L_HALF |
 * | `DODGE_LEFT`, frames 4-17 | DODGE_L |
 * | `DODGE_RIGHT` | The mirror |
 * | `DUCK` | DUCK |
 * | `BLOCK` | BLOCK, drawn in the normal palette (no darkening) |
 * | `HIT` | HIT; the white flash on actionFrame 0-3 is kept |
 * | isExhausted and idle | EXHAUSTED_A / B, alternating every 12 global frames, in pink palette |
 * | `KNOCKED_DOWN` / `KO`, frames 0-11 | FALL |
 * | `KNOCKED_DOWN` / `KO`, frames 12+ | DOWN |
 * | `KNOCKED_DOWN` with referee.downFighter === 'PLAYER' and playerMashCount >= 1 | GET_UP, every other 8-frame window |
 */
export function resolvePlayerFrame(
  action: string,
  actionFrame: number = 0,
  state?: any
): PlayerFrameResolution {
  const globalFrame = state?.frame ?? 0;
  const isExhausted = Boolean(state?.player?.isExhausted);
  const downFighter = state?.referee?.downFighter;
  const playerMashCount = state?.referee?.playerMashCount ?? 0;

  let frameName = 'IDLE_A';

  const GAMEPLAY_ACTIONS = new Set([
    'IDLE', 'DUCK', 'BLOCK', 'HIT',
    'DODGE_LEFT', 'DODGE_RIGHT',
    'PUNCH_LEFT_HEAD', 'PUNCH_RIGHT_HEAD',
    'PUNCH_LEFT_BODY', 'PUNCH_RIGHT_BODY',
    'STAR_PUNCH',
    'JAB_LEFT', 'JAB_RIGHT', 'HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT',
    'KNOCKED_DOWN', 'KO',
  ]);

  if (PLAYER_FRAMES[action] && !GAMEPLAY_ACTIONS.has(action)) {
    frameName = action;
  } else if (action === 'KNOCKED_DOWN' || action === 'KO') {
    if (downFighter === 'PLAYER' && playerMashCount >= 1) {
      // GET_UP, every other 8-frame window (he struggles up as you mash)
      const windowIdx = Math.floor(globalFrame / 8);
      if (windowIdx % 2 === 1) {
        frameName = 'GET_UP';
      } else {
        frameName = actionFrame < 12 ? 'FALL' : 'DOWN';
      }
    } else if (actionFrame < 12) {
      frameName = 'FALL';
    } else {
      frameName = 'DOWN';
    }
  } else if (action === 'IDLE') {
    if (isExhausted) {
      // EXHAUSTED_A / B, alternating every 12 global frames
      const exhWindow = Math.floor(globalFrame / 12);
      frameName = exhWindow % 2 === 0 ? 'EXHAUSTED_A' : 'EXHAUSTED_B';
    } else {
      // IDLE_A / IDLE_B, alternating every 16 global frames
      const idleWindow = Math.floor(globalFrame / 16);
      frameName = idleWindow % 2 === 0 ? 'IDLE_A' : 'IDLE_B';
    }
  } else if (action === 'PUNCH_LEFT_HEAD' || action === 'JAB_LEFT') {
    if (actionFrame <= 2) {
      frameName = 'JAB_L_WIND';
    } else if (actionFrame === 3) {
      frameName = 'JAB_L_MID';
    } else if (actionFrame <= 8) {
      frameName = 'JAB_L_HIT';
    } else {
      frameName = 'JAB_L_BACK';
    }
  } else if (action === 'PUNCH_RIGHT_HEAD' || action === 'JAB_RIGHT') {
    if (actionFrame <= 2) {
      frameName = 'JAB_R_WIND';
    } else if (actionFrame === 3) {
      frameName = 'JAB_R_MID';
    } else if (actionFrame <= 8) {
      frameName = 'JAB_R_HIT';
    } else {
      frameName = 'JAB_R_BACK';
    }
  } else if (action === 'PUNCH_LEFT_BODY' || action === 'HOOK_LEFT') {
    if (actionFrame <= 2) {
      frameName = 'BODY_L_WIND';
    } else if (actionFrame === 3) {
      frameName = 'BODY_L_MID';
    } else if (actionFrame <= 8) {
      frameName = 'BODY_L_HIT';
    } else {
      frameName = 'BODY_L_BACK';
    }
  } else if (action === 'PUNCH_RIGHT_BODY' || action === 'HOOK_RIGHT') {
    if (actionFrame <= 2) {
      frameName = 'BODY_R_WIND';
    } else if (actionFrame === 3) {
      frameName = 'BODY_R_MID';
    } else if (actionFrame <= 8) {
      frameName = 'BODY_R_HIT';
    } else {
      frameName = 'BODY_R_BACK';
    }
  } else if (action === 'STAR_PUNCH' || action === 'UPPERCUT') {
    if (actionFrame <= 6) {
      frameName = 'STAR_WIND';
    } else if (actionFrame === 7) {
      frameName = 'STAR_MID';
    } else if (actionFrame <= 15) {
      frameName = 'STAR_HIT';
    } else {
      frameName = 'STAR_BACK';
    }
  } else if (action === 'DODGE_LEFT') {
    if (actionFrame <= 3 || actionFrame >= 18) {
      frameName = 'DODGE_L_HALF';
    } else {
      frameName = 'DODGE_L';
    }
  } else if (action === 'DODGE_RIGHT') {
    if (actionFrame <= 3 || actionFrame >= 18) {
      frameName = 'DODGE_R_HALF';
    } else {
      frameName = 'DODGE_R';
    }
  } else if (action === 'DUCK') {
    if (actionFrame <= 2 || actionFrame >= 17) {
      frameName = 'DUCK_HALF';
    } else {
      frameName = 'DUCK';
    }
  } else if (action === 'BLOCK') {
    if (actionFrame <= 2) {
      frameName = 'BLOCK_HALF';
    } else {
      frameName = 'BLOCK';
    }
  } else if (action === 'HIT') {
    if (actionFrame >= 10) {
      frameName = 'HIT_BACK';
    } else {
      frameName = 'HIT';
    }
  } else {
    // Default fallback
    frameName = 'IDLE_A';
  }

  const baseSprite = PLAYER_FRAMES[frameName] || PLAYER_IDLE_A;
  const anchorX = PLAYER_ANCHORS[frameName] ?? 30;

  // Palette handling:
  // Exhausted pink palette when isExhausted and in idle
  let palette = (isExhausted && (frameName === 'EXHAUSTED_A' || frameName === 'EXHAUSTED_B'))
    ? getExhaustedPlayerPalette(baseSprite.palette)
    : { ...baseSprite.palette };

  // HIT white flash on actionFrame 0-3
  if (action === 'HIT' && actionFrame <= 3) {
    const flashPal: Record<string, number> = {};
    for (const [k, v] of Object.entries(palette)) {
      flashPal[k] = (v as number) === -1 ? -1 : toFlashPalette(v as number);
    }
    palette = flashPal;
  }

  return {
    frameName,
    sprite: {
      width: baseSprite.width,
      height: baseSprite.height,
      palette,
      rows: baseSprite.rows,
    },
    anchorX,
  };
}

// Backward-compatible getPlayerSprite
export function getPlayerSprite(
  action: string,
  isExhausted: boolean = false,
  actionFrame: number = 0,
  globalFrame: number = 0
): SpriteData {
  const dummyState = {
    frame: globalFrame,
    player: { isExhausted, action, actionFrame },
  };
  return resolvePlayerFrame(action, actionFrame, dummyState).sprite;
}
