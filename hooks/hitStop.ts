import { SoundEvent, InputFrame } from '../src/core/types';

/**
 * Returns the hit-stop freeze frames for a given set of engine sound events.
 * Returns the largest applicable value:
 * - KNOCKDOWN, KO or TKO -> 18 frames
 * - STAR_PUNCH + landed HIT_HEAD/HIT_BODY/COUNTER -> 12 frames
 * - COUNTER -> 8 frames
 * - HIT_HEAD or HIT_BODY -> 5 frames
 * - Otherwise -> 0 frames
 */
export function hitStopFrames(events: SoundEvent[]): number {
  if (events.some((e) => e === 'KNOCKDOWN' || e === 'KO' || e === 'TKO')) {
    return 18;
  }

  const hasStarPunch = events.includes('STAR_PUNCH');
  const hasLandedHit = events.some((e) => e === 'HIT_HEAD' || e === 'HIT_BODY' || e === 'COUNTER');
  if (hasStarPunch && hasLandedHit) {
    return 12;
  }

  if (events.includes('COUNTER')) {
    return 8;
  }

  if (events.some((e) => e === 'HIT_HEAD' || e === 'HIT_BODY')) {
    return 5;
  }

  return 0;
}

/**
 * Pure helper for buffering inputs pressed during hit-stop freeze.
 * Merges incoming button presses into the buffered frame so the most recent
 * press of each button is preserved.
 */
export function bufferInput(buffered: InputFrame, incoming: InputFrame): InputFrame {
  const result: InputFrame = { ...buffered };
  for (const key of Object.keys(incoming) as (keyof InputFrame)[]) {
    if (incoming[key] !== undefined) {
      result[key] = incoming[key];
    }
  }
  return result;
}
