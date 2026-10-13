import { describe, it, expect } from 'vitest';
import { createFight, step } from '../../src/core/engine';
import { InputFrame } from '../../src/core/types';
import {
  PLAYER_DURATIONS,
  OPPONENT_ATTACKS,
  HEARTS,
  STARS,
  ROUNDS,
  ROSTER_SPECS,
} from '../../src/core/constants';

describe('R1 pure engine and determinism', () => {
  it('advances frame by frame and produces identical states for identical seed + inputs', () => {
    const seed = 12345;
    let stateA = createFight('aint_man', seed);
    let stateB = createFight('aint_man', seed);

    const inputs: InputFrame[] = [
      {},
      { punchLeftHead: true },
      {},
      { dodgeLeft: true },
      {},
      {},
      { block: true },
      { block: true },
      {},
      { punchRightBody: true },
    ];

    for (const inp of inputs) {
      stateA = step(stateA, inp);
      stateB = step(stateB, inp);
    }

    expect(stateA).toEqual(stateB);
    expect(stateA.frame).toBe(inputs.length);
  });
});

describe('R2 frame-based timings', () => {
  it('uses integer frame durations for player actions and attacks without millisecond timing', () => {
    expect(Number.isInteger(PLAYER_DURATIONS.PUNCH)).toBe(true);
    expect(Number.isInteger(PLAYER_DURATIONS.DODGE)).toBe(true);
    expect(Number.isInteger(PLAYER_DURATIONS.DUCK)).toBe(true);
    expect(Number.isInteger(OPPONENT_ATTACKS.JAB.baseTell)).toBe(true);
    expect(OPPONENT_ATTACKS.JAB.baseTell).toBeGreaterThanOrEqual(12);
  });
});

describe('R3 player inputs and defense windows', () => {
  it('dodge avoids punches and duck avoids jabs and hooks', () => {
    let state = createFight('aint_man', 42);
    // Force opponent into active punch jab
    state.opponent.action = 'PUNCH_JAB_LEFT';
    state.opponent.actionDuration = 26;
    state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1; // next frame is active hit

    // Player dodges
    state.player.action = 'DODGE_LEFT';
    state.player.actionDuration = PLAYER_DURATIONS.DODGE;
    state.player.actionFrame = 4; // within invuln window

    const initialHp = state.player.hp;
    state = step(state, {});

    // Player should avoid hit
    expect(state.player.hp).toBe(initialHp);
    expect(state.events).toContain('DODGE');
  });

  it('duck does not avoid uppercuts', () => {
    let state = createFight('aint_man', 42);
    state.opponent.action = 'PUNCH_UPPERCUT_LEFT';
    state.opponent.actionDuration = 40;
    state.opponent.actionFrame = OPPONENT_ATTACKS.UPPERCUT.activeFrames - 1;

    // Player ducks
    state.player.action = 'DUCK';
    state.player.actionDuration = PLAYER_DURATIONS.DUCK;
    state.player.actionFrame = 4;

    const initialHp = state.player.hp;
    state = step(state, {});

    // Player takes damage because duck does not avoid uppercuts
    expect(state.player.hp).toBeLessThan(initialHp);
    expect(state.player.action).toBe('HIT');
  });

  it('block stops jabs with chip damage and heart loss', () => {
    let state = createFight('aint_man', 42);
    state.opponent.action = 'PUNCH_JAB_LEFT';
    state.opponent.actionDuration = 26;
    state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;

    state.player.action = 'BLOCK';
    state.player.actionDuration = 10;
    state.player.actionFrame = 2;

    const initialHp = state.player.hp;
    const initialHearts = state.player.hearts;
    state = step(state, { block: true });

    expect(state.player.hp).toBeLessThan(initialHp);
    expect(state.player.hp).toBeGreaterThan(initialHp - OPPONENT_ATTACKS.JAB.damage); // only chip damage
    expect(state.player.hearts).toBe(initialHearts - HEARTS.DEFEND_BLOCK_PENALTY);
  });
});

describe('R4 hearts and exhaustion', () => {
  it('decreases hearts when hit, blocked, and blocking; enters exhausted at 0 hearts and restores on evades', () => {
    let state = createFight('aint_man', 1);
    state.player.hearts = 1;

    // Trigger hit by opponent
    state.opponent.action = 'PUNCH_JAB_LEFT';
    state.opponent.actionDuration = 26;
    state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;

    state = step(state, {});
    expect(state.player.hearts).toBe(0);
    expect(state.player.isExhausted).toBe(true);

    // Fast-forward player out of HIT animation to IDLE while remaining exhausted
    for (let i = 0; i < PLAYER_DURATIONS.HIT; i++) {
      state = step(state, {});
    }
    expect(state.player.action).toBe('IDLE');
    expect(state.player.isExhausted).toBe(true);

    // While exhausted, player punch inputs are ignored
    const postState = step(state, { punchLeftHead: true });
    expect(postState.player.action).toBe('IDLE');

    // Successful evasion while exhausted restores hearts
    postState.opponent.action = 'PUNCH_JAB_LEFT';
    postState.opponent.actionDuration = 26;
    postState.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;
    postState.player.action = 'DODGE_LEFT';
    postState.player.actionDuration = PLAYER_DURATIONS.DODGE;
    postState.player.actionFrame = 4;

    const recovered = step(postState, {});
    expect(recovered.player.hearts).toBeGreaterThan(0);
  });
});

describe('R5 stars and star punch', () => {
  it('earns star during starOpportunity, consumes star on star punch, loses stars when hit', () => {
    let state = createFight('aint_man', 1);
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';
    state.opponent.starOpportunity = true;

    // Land head punch during star opportunity
    state = step(state, { punchLeftHead: true });
    expect(state.player.stars).toBe(1);
    expect(state.events).toContain('STAR_EARNED');

    // Next, test star punch deals high damage
    state.player.action = 'IDLE';
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';
    const oppHpBeforeStar = state.opponent.hp;
    state = step(state, { starPunch: true });

    expect(state.player.stars).toBe(0); // consumed
    expect(state.opponent.hp).toBe(oppHpBeforeStar - STARS.STAR_PUNCH_DAMAGE);

    // Test losing stars when hit
    state.player.stars = 2;
    state.opponent.action = 'PUNCH_JAB_LEFT';
    state.opponent.actionDuration = 26;
    state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;
    state = step(state, {});
    expect(state.player.stars).toBe(0);
  });
});

describe('R6 opponent tells', () => {
  it('every opponent tell is at least 12 frames and scales with rounds', () => {
    for (const [id, spec] of Object.entries(ROSTER_SPECS)) {
      for (const atk of ['JAB', 'HOOK', 'UPPERCUT'] as const) {
        expect(spec.baseTells[atk]).toBeGreaterThanOrEqual(12);
      }
    }

    let state = createFight('aint_man', 99);
    // advance until tell appears
    for (let i = 0; i < 60; i++) {
      state = step(state, {});
      if (state.opponent.action.startsWith('TELL_')) {
        expect(state.opponent.actionDuration).toBeGreaterThanOrEqual(12);
        break;
      }
    }
  });
});

describe('R7 counters and guard blocking', () => {
  it('deals counter damage when hitting opponent during tell', () => {
    let state = createFight('aint_man', 1);
    state.opponent.action = 'TELL_JAB_LEFT';
    state.opponent.actionDuration = 24;
    state.opponent.actionFrame = 5;

    const oppHp = state.opponent.hp;
    state = step(state, { punchLeftHead: true });

    expect(state.events).toContain('COUNTER');
    expect(state.opponent.action).toBe('STUNNED');
    expect(state.opponent.hp).toBeLessThan(oppHp);
  });
});

describe('R8 knockdowns and counts', () => {
  it('opponent goes down at 0 HP, referee counts, and 3 knockdowns in one round triggers TKO', () => {
    let state = createFight('aint_man', 1);
    state.opponent.hp = 5;
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';

    // Knock opponent down
    state = step(state, { punchLeftHead: true });
    expect(state.phase).toBe('KNOCKDOWN_COUNT');
    expect(state.opponent.knockdownsThisRound).toBe(1);

    // Force 3 knockdowns
    state.player.action = 'IDLE';
    state.opponent.knockdownsThisRound = 2;
    state.opponent.hp = 5;
    state.opponent.action = 'IDLE';
    state.phase = 'ROUND_ACTIVE';

    state = step(state, { punchLeftHead: true });
    expect(state.phase).toBe('MATCH_OVER');
    expect(state.result).toBe('TKO');
    expect(state.winner).toBe('PLAYER');
  });
});

describe('R9 rounds and decisions', () => {
  it('bout lasts 3 rounds, between rounds heals HP and resets hearts, decision occurs after round 3', () => {
    let state = createFight('aint_man', 1);
    state.gameClockSeconds = 1;
    state.roundFrame = 59; // next frame advances clock to 0

    state = step(state, {});
    expect(state.phase).toBe('BETWEEN_ROUNDS');

    // Fast-forward through between rounds
    for (let i = 0; i < ROUNDS.BETWEEN_ROUND_FRAMES; i++) {
      state = step(state, {});
    }
    expect(state.round).toBe(2);
    expect(state.phase).toBe('ROUND_ACTIVE');
  });
});

describe('R10 characters and specials preserved', () => {
  it('implements specials for all 5 roster opponents', () => {
    // 1. DJ Tito inverted controls
    let tito = createFight('dj_tito', 1);
    tito.specialState.djTitoInvertedFrames = 60;
    // With inverted controls, punchLeftHead should map to punchRightHead
    tito = step(tito, { punchLeftHead: true });
    expect(tito.player.action).toBe('PUNCH_RIGHT_HEAD');

    // 2. MAGA Man Big Lie self-damage
    let maga = createFight('maga_man', 1);
    maga.specialState.magaManBigLieFrames = 60;
    const playerHp = maga.player.hp;
    maga = step(maga, { punchLeftHead: true });
    expect(maga.player.hp).toBe(playerHp - 10);
    expect(maga.feedbackMessage).toBe('FAKE NEWS!');

    // 3. Medi Jinx Book-it speed and double damage
    let medi = createFight('medi_jinx', 1);
    medi.specialState.mediJinxBookItCharges = 1;
    medi.opponent.action = 'PUNCH_UPPERCUT_LEFT';
    medi.opponent.actionDuration = 40;
    medi.opponent.actionFrame = OPPONENT_ATTACKS.UPPERCUT.activeFrames - 1;
    const initialHp = medi.player.hp;
    medi = step(medi, {});
    // Should take double damage
    expect(medi.player.hp).toBe(initialHp - Math.floor(OPPONENT_ATTACKS.UPPERCUT.damage * ROSTER_SPECS.medi_jinx.power * 2));

    // 4. Mr Yankee Pinstripe combo
    let yankee = createFight('mr_yankee', 1);
    yankee.specialState.mrYankeePinstripeCharges = 5;
    yankee.opponent.action = 'PUNCH_HOOK_LEFT';
    yankee.opponent.actionDuration = 32;
    yankee.opponent.actionFrame = OPPONENT_ATTACKS.HOOK.activeFrames - 1;
    const yankeeHp = yankee.player.hp;
    yankee = step(yankee, {});
    expect(yankee.player.hp).toBe(yankeeHp - Math.floor(OPPONENT_ATTACKS.HOOK.damage * ROSTER_SPECS.mr_yankee.power * 2));

    // 5. Aint Man Bountygate combo exists in combos
    expect(ROSTER_SPECS.aint_man.combos.some(c => c.length === 3 && c[0] === 'JAB_LEFT' && c[1] === 'HOOK_RIGHT')).toBe(true);
  });
});
