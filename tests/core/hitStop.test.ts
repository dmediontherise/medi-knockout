import { describe, it, expect } from 'vitest';
import { hitStopFrames, bufferInput } from '../../hooks/hitStop';
import { SoundEvent, InputFrame } from '../../src/core/types';

describe('Task 015 Requirement 1: Hit-stop', () => {
  it('hitStopFrames returns correct frames based on priority table', () => {
    // KNOCKDOWN, KO, TKO -> 18 frames
    expect(hitStopFrames(['KNOCKDOWN'])).toBe(18);
    expect(hitStopFrames(['KO'])).toBe(18);
    expect(hitStopFrames(['TKO'])).toBe(18);
    expect(hitStopFrames(['KNOCKDOWN', 'STAR_PUNCH', 'HIT_HEAD'])).toBe(18);

    // STAR_PUNCH + landed hit (HIT_HEAD, HIT_BODY, COUNTER) -> 12 frames
    expect(hitStopFrames(['STAR_PUNCH', 'HIT_HEAD'])).toBe(12);
    expect(hitStopFrames(['STAR_PUNCH', 'HIT_BODY'])).toBe(12);
    expect(hitStopFrames(['STAR_PUNCH', 'COUNTER'])).toBe(12);
    expect(hitStopFrames(['STAR_PUNCH'])).toBe(0); // star punch alone without landed hit -> 0

    // COUNTER -> 8 frames
    expect(hitStopFrames(['COUNTER'])).toBe(8);
    expect(hitStopFrames(['COUNTER', 'HIT_HEAD'])).toBe(8);

    // HIT_HEAD or HIT_BODY -> 5 frames
    expect(hitStopFrames(['HIT_HEAD'])).toBe(5);
    expect(hitStopFrames(['HIT_BODY'])).toBe(5);
    expect(hitStopFrames(['SWING', 'HIT_HEAD'])).toBe(5);

    // Otherwise -> 0 frames
    expect(hitStopFrames([])).toBe(0);
    expect(hitStopFrames(['SWING'])).toBe(0);
    expect(hitStopFrames(['DODGE'])).toBe(0);
    expect(hitStopFrames(['HIT_BLOCK'])).toBe(0);
    expect(hitStopFrames(['BELL'])).toBe(0);
    expect(hitStopFrames(['COUNT'])).toBe(0);
  });

  it('bufferInput preserves the most recent press of each button', () => {
    let buffered: InputFrame = {};

    buffered = bufferInput(buffered, { punchLeftHead: true });
    expect(buffered.punchLeftHead).toBe(true);

    buffered = bufferInput(buffered, { dodgeRight: true });
    expect(buffered.punchLeftHead).toBe(true);
    expect(buffered.dodgeRight).toBe(true);

    // Overriding a button with new value
    buffered = bufferInput(buffered, { punchLeftHead: false, duck: true });
    expect(buffered.punchLeftHead).toBe(false);
    expect(buffered.dodgeRight).toBe(true);
    expect(buffered.duck).toBe(true);
  });
});
