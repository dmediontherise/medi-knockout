import { describe, it, expect } from 'vitest';
import { createFight, step } from '../../src/core/engine';
import { InputFrame } from '../../src/core/types';
import {
  PLAYER_DURATIONS,
  OPPONENT_ATTACKS,
  HEARTS,
  STARS,
  COMBAT,
  REFEREE,
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

  // Task 002 Requirement 2:
  // dodge right avoids a hook; duck avoids a hook; block does NOT stop a hook or an uppercut (player hp decreases in both)
  it('dodge right avoids hook, duck avoids hook, and block does not stop hook or uppercut', () => {
    // 1. Dodge right avoids hook
    let stateDodge = createFight('aint_man', 42);
    stateDodge.opponent.action = 'PUNCH_HOOK_LEFT';
    stateDodge.opponent.actionDuration = 32;
    stateDodge.opponent.actionFrame = OPPONENT_ATTACKS.HOOK.activeFrames - 1;
    stateDodge.player.action = 'DODGE_RIGHT';
    stateDodge.player.actionDuration = PLAYER_DURATIONS.DODGE;
    stateDodge.player.actionFrame = PLAYER_DURATIONS.DODGE_INVULN_START;

    const hpBeforeDodge = stateDodge.player.hp;
    stateDodge = step(stateDodge, {});
    expect(stateDodge.player.hp).toBe(hpBeforeDodge);
    expect(stateDodge.events).toContain('DODGE');

    // 2. Duck avoids hook
    let stateDuck = createFight('aint_man', 42);
    stateDuck.opponent.action = 'PUNCH_HOOK_RIGHT';
    stateDuck.opponent.actionDuration = 32;
    stateDuck.opponent.actionFrame = OPPONENT_ATTACKS.HOOK.activeFrames - 1;
    stateDuck.player.action = 'DUCK';
    stateDuck.player.actionDuration = PLAYER_DURATIONS.DUCK;
    stateDuck.player.actionFrame = PLAYER_DURATIONS.DUCK_INVULN_START;

    const hpBeforeDuck = stateDuck.player.hp;
    stateDuck = step(stateDuck, {});
    expect(stateDuck.player.hp).toBe(hpBeforeDuck);
    expect(stateDuck.events).toContain('DODGE');

    // 3. Block does NOT stop hook
    let stateBlockHook = createFight('aint_man', 42);
    stateBlockHook.opponent.action = 'PUNCH_HOOK_LEFT';
    stateBlockHook.opponent.actionDuration = 32;
    stateBlockHook.opponent.actionFrame = OPPONENT_ATTACKS.HOOK.activeFrames - 1;
    stateBlockHook.player.action = 'BLOCK';
    stateBlockHook.player.actionDuration = 10;
    stateBlockHook.player.actionFrame = 2;

    const hpBeforeBlockHook = stateBlockHook.player.hp;
    stateBlockHook = step(stateBlockHook, { block: true });
    expect(stateBlockHook.player.hp).toBeLessThan(hpBeforeBlockHook);
    expect(stateBlockHook.player.action).toBe('HIT');

    // 4. Block does NOT stop uppercut
    let stateBlockUppercut = createFight('aint_man', 42);
    stateBlockUppercut.opponent.action = 'PUNCH_UPPERCUT_LEFT';
    stateBlockUppercut.opponent.actionDuration = 40;
    stateBlockUppercut.opponent.actionFrame = OPPONENT_ATTACKS.UPPERCUT.activeFrames - 1;
    stateBlockUppercut.player.action = 'BLOCK';
    stateBlockUppercut.player.actionDuration = 10;
    stateBlockUppercut.player.actionFrame = 2;

    const hpBeforeBlockUppercut = stateBlockUppercut.player.hp;
    stateBlockUppercut = step(stateBlockUppercut, { block: true });
    expect(stateBlockUppercut.player.hp).toBeLessThan(hpBeforeBlockUppercut);
    expect(stateBlockUppercut.player.action).toBe('HIT');
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

  // Task 002 Requirement 3:
  // a player punch that lands gives +1 heart; a player punch that is blocked by the opponent's guard gives -1 heart
  it('landed player punch awards heart bonus and guard-blocked punch imposes heart penalty', () => {
    // 1. Landing a punch awards +1 heart
    let stateLand = createFight('aint_man', 1);
    stateLand.opponent.action = 'IDLE';
    stateLand.opponent.guard = 'LOW'; // Low guard means head punch lands
    stateLand.player.hearts = 5;

    stateLand = step(stateLand, { punchLeftHead: true });
    expect(stateLand.player.hearts).toBe(5 + HEARTS.PUNCH_LANDED_BONUS);

    // 2. Punch blocked by guard gives -1 heart
    let stateBlocked = createFight('aint_man', 1);
    stateBlocked.opponent.action = 'IDLE';
    stateBlocked.opponent.guard = 'HIGH'; // High guard blocks head punch
    stateBlocked.player.hearts = 5;

    stateBlocked = step(stateBlocked, { punchLeftHead: true });
    expect(stateBlocked.player.hearts).toBe(5 - HEARTS.BLOCKED_PENALTY);
  });

  // Task 002 Requirement 10:
  // an exhausted player who evades enough attacks to reach EXHAUSTION_RECOVERY_THRESHOLD has isExhausted === false afterwards and punch input then produces punch action
  it('exhausted player recovering to threshold clears exhaustion and re-enables punching', () => {
    let state = createFight('aint_man', 1);
    state.player.hearts = 0;
    state.player.isExhausted = true;
    state.player.action = 'IDLE';

    // Evade attacks until threshold is reached
    while (state.player.hearts < HEARTS.EXHAUSTION_RECOVERY_THRESHOLD) {
      state.player.action = 'DODGE_LEFT';
      state.player.actionDuration = PLAYER_DURATIONS.DODGE;
      state.player.actionFrame = PLAYER_DURATIONS.DODGE_INVULN_START;

      state.opponent.action = 'PUNCH_JAB_LEFT';
      state.opponent.actionDuration = 26;
      state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;

      state = step(state, {});
    }

    expect(state.player.isExhausted).toBe(false);
    expect(state.player.hearts).toBeGreaterThanOrEqual(HEARTS.EXHAUSTION_RECOVERY_THRESHOLD);

    // Fast forward dodge finish to IDLE
    state.player.action = 'IDLE';
    state.player.actionFrame = 0;
    state.player.actionDuration = 0;
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';

    // Player punching should now be accepted
    state = step(state, { punchLeftHead: true });
    expect(state.player.action).toBe('PUNCH_LEFT_HEAD');
  });

  // Task 003 Requirement 14 (M12): hit penalty HEARTS.HIT_PENALTY reduces hearts by 3 when starting > 3
  it('R4 hit penalty reduces hearts by exactly HEARTS.HIT_PENALTY when starting above 3', () => {
    let state = createFight('aint_man', 1);
    state.player.hearts = 8;
    state.opponent.action = 'PUNCH_JAB_LEFT';
    state.opponent.actionDuration = 26;
    state.opponent.actionFrame = OPPONENT_ATTACKS.JAB.activeFrames - 1;

    state = step(state, {});
    expect(state.player.hearts).toBe(8 - HEARTS.HIT_PENALTY);
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

  // Task 002 Requirement 11:
  // with 3 stars, landing another punch in a star-opportunity window leaves stars === 3
  it('caps player stars at 3 even during star opportunity', () => {
    let state = createFight('aint_man', 1);
    state.player.stars = STARS.MAX_STARS;
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';
    state.opponent.starOpportunity = true;

    state = step(state, { punchLeftHead: true });
    expect(state.player.stars).toBe(STARS.MAX_STARS);
  });
});

describe('R6 opponent tells', () => {
  it('every opponent tell is at least 12 frames and scales with rounds', () => {
    for (const [, spec] of Object.entries(ROSTER_SPECS)) {
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

  // Task 002 Requirement 4:
  // for one roster opponent, the tell length observed at round 3 is strictly shorter than at round 1 and never below 12;
  // two createFight runs with the same seed and empty inputs reach the same opponent action sequence over 600 frames
  it('tell length at round 3 is strictly shorter than at round 1 and reaches same sequence for same seed over 600 frames', () => {
    // 1. Tell length round 3 vs round 1
    const runUntilTell = (round: number): number => {
      let state = createFight('aint_man', 123);
      state.round = round;
      for (let i = 0; i < 200; i++) {
        state = step(state, {});
        if (state.opponent.action.startsWith('TELL_')) {
          return state.opponent.actionDuration;
        }
      }
      return -1;
    };

    const r1Tell = runUntilTell(1);
    const r3Tell = runUntilTell(3);
    expect(r1Tell).toBeGreaterThan(0);
    expect(r3Tell).toBeGreaterThan(0);
    expect(r3Tell).toBeLessThan(r1Tell);
    expect(r3Tell).toBeGreaterThanOrEqual(12);

    // 2. Deterministic action sequence over 600 frames
    const seed = 54321;
    let s1 = createFight('aint_man', seed);
    let s2 = createFight('aint_man', seed);

    const actions1: string[] = [];
    const actions2: string[] = [];

    for (let f = 0; f < 600; f++) {
      s1 = step(s1, {});
      s2 = step(s2, {});
      actions1.push(s1.opponent.action);
      actions2.push(s2.opponent.action);
    }

    expect(actions1).toEqual(actions2);
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

  // Task 002 Requirement 5:
  // a head punch into an idle HIGH guard and a body punch into an idle LOW guard are each blocked
  // (player.hearts drops by 1, no opponent hp loss); the opposite pairings land.
  it('guard blocks matching punches and opposite pairings land', () => {
    // 1. Head punch into idle HIGH guard is blocked
    let sHighBlocked = createFight('aint_man', 1);
    sHighBlocked.opponent.action = 'IDLE';
    sHighBlocked.opponent.guard = 'HIGH';
    const oppHp1 = sHighBlocked.opponent.hp;
    const playerHearts1 = sHighBlocked.player.hearts;

    sHighBlocked = step(sHighBlocked, { punchLeftHead: true });
    expect(sHighBlocked.player.hearts).toBe(playerHearts1 - HEARTS.BLOCKED_PENALTY);
    expect(sHighBlocked.opponent.hp).toBe(oppHp1);
    expect(sHighBlocked.events).toContain('HIT_BLOCK');

    // 2. Body punch into idle LOW guard is blocked
    let sLowBlocked = createFight('aint_man', 1);
    sLowBlocked.opponent.action = 'IDLE';
    sLowBlocked.opponent.guard = 'LOW';
    const oppHp2 = sLowBlocked.opponent.hp;
    const playerHearts2 = sLowBlocked.player.hearts;

    sLowBlocked = step(sLowBlocked, { punchLeftBody: true });
    expect(sLowBlocked.player.hearts).toBe(playerHearts2 - HEARTS.BLOCKED_PENALTY);
    expect(sLowBlocked.opponent.hp).toBe(oppHp2);
    expect(sLowBlocked.events).toContain('HIT_BLOCK');

    // 3. Head punch into idle LOW guard lands
    let sHighLand = createFight('aint_man', 1);
    sHighLand.opponent.action = 'IDLE';
    sHighLand.opponent.guard = 'LOW';
    const oppHp3 = sHighLand.opponent.hp;

    sHighLand = step(sHighLand, { punchLeftHead: true });
    expect(sHighLand.opponent.hp).toBeLessThan(oppHp3);
    expect(sHighLand.events).toContain('HIT_HEAD');

    // 4. Body punch into idle HIGH guard lands
    let sLowLand = createFight('aint_man', 1);
    sLowLand.opponent.action = 'IDLE';
    sLowLand.opponent.guard = 'HIGH';
    const oppHp4 = sLowLand.opponent.hp;

    sLowLand = step(sLowLand, { punchLeftBody: true });
    expect(sLowLand.opponent.hp).toBeLessThan(oppHp4);
    expect(sLowLand.events).toContain('HIT_BODY');
  });

  // Task 002 Requirement 11:
  // a counter punch deals exactly COUNTER_MULTIPLIER times the damage of the same punch landed outside a counter window
  it('counter punch deals exactly COUNTER_MULTIPLIER times regular punch damage', () => {
    // Normal landed head punch
    let normalState = createFight('aint_man', 1);
    normalState.opponent.action = 'IDLE';
    normalState.opponent.guard = 'LOW';
    const normalHpBefore = normalState.opponent.hp;
    normalState = step(normalState, { punchLeftHead: true });
    const normalDamage = normalHpBefore - normalState.opponent.hp;

    // Counter head punch during tell
    let counterState = createFight('aint_man', 1);
    counterState.opponent.action = 'TELL_JAB_LEFT';
    counterState.opponent.actionDuration = 24;
    counterState.opponent.actionFrame = 5;
    const counterHpBefore = counterState.opponent.hp;
    counterState = step(counterState, { punchLeftHead: true });
    const counterDamage = counterHpBefore - counterState.opponent.hp;

    expect(counterDamage).toBe(Math.floor(normalDamage * COMBAT.COUNTER_MULTIPLIER));
  });

  // Task 003 Requirement 14 (M13): punching a STUNNED opponent branch applies STUNNED_MULTIPLIER
  it('R7 punching a STUNNED opponent deals extra damage using STUNNED_MULTIPLIER', () => {
    // Normal head punch
    let normalState = createFight('aint_man', 1);
    normalState.opponent.action = 'IDLE';
    normalState.opponent.guard = 'LOW';
    const normalHpBefore = normalState.opponent.hp;
    normalState = step(normalState, { punchLeftHead: true });
    const normalDamage = normalHpBefore - normalState.opponent.hp;

    // Head punch while opponent is STUNNED
    let stunnedState = createFight('aint_man', 1);
    stunnedState.opponent.action = 'STUNNED';
    stunnedState.opponent.actionDuration = 60;
    stunnedState.opponent.actionFrame = 10;
    const stunnedHpBefore = stunnedState.opponent.hp;
    stunnedState = step(stunnedState, { punchLeftHead: true });
    const stunnedDamage = stunnedHpBefore - stunnedState.opponent.hp;

    expect(stunnedDamage).toBe(Math.floor(normalDamage * COMBAT.STUNNED_MULTIPLIER));
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

  // Task 002 Requirement 6:
  // player at 0 hp goes down, gets up when mash inputs reach the constant threshold before count 10,
  // and is KO'd (result === 'KO', winner === 'OPPONENT') when they do not;
  // referee count advances 1 per constant N frames
  it('player knockdown, mash get-up before count 10, KO when no mash, and referee count cadence', () => {
    // 1. Referee count advances 1 per REFEREE.FRAMES_PER_COUNT frames
    let sCount = createFight('aint_man', 1);
    sCount.player.hp = 0;
    sCount.phase = 'KNOCKDOWN_COUNT';
    sCount.referee.count = 0;
    sCount.referee.countFrameCounter = 0;
    sCount.referee.downFighter = 'PLAYER';

    for (let f = 0; f < REFEREE.FRAMES_PER_COUNT; f++) {
      sCount = step(sCount, {});
    }
    expect(sCount.referee.count).toBe(1);

    // 2. Player gets up when mash inputs reach threshold
    let sMash = createFight('aint_man', 1);
    sMash.player.hp = 0;
    sMash.phase = 'KNOCKDOWN_COUNT';
    sMash.referee.count = 2;
    sMash.referee.downFighter = 'PLAYER';
    sMash.referee.playerMashCount = 0;
    sMash.referee.targetGetUpCount = REFEREE.MASHES_NEEDED_BASE;

    for (let m = 0; m < REFEREE.MASHES_NEEDED_BASE; m++) {
      sMash = step(sMash, { mash: true });
    }
    expect(sMash.phase).toBe('ROUND_ACTIVE');
    expect(sMash.player.action).toBe('IDLE');
    expect(sMash.player.hp).toBeGreaterThan(0);

    // 3. Player is KO'd when mash does not happen and count hits 10
    let sKo = createFight('aint_man', 1);
    sKo.player.hp = 0;
    sKo.phase = 'KNOCKDOWN_COUNT';
    sKo.referee.count = 9;
    sKo.referee.countFrameCounter = REFEREE.FRAMES_PER_COUNT - 1;
    sKo.referee.downFighter = 'PLAYER';

    sKo = step(sKo, {});
    expect(sKo.referee.count).toBe(REFEREE.MAX_COUNT);
    expect(sKo.phase).toBe('MATCH_OVER');
    expect(sKo.result).toBe('KO');
    expect(sKo.winner).toBe('OPPONENT');
  });

  // Task 003 Requirement 14 (M11): opponent get-up branch restores opponent from knockdown before count 10
  it('R8 opponent get-up branch restores opponent to ROUND_ACTIVE with restored HP', () => {
    let state = createFight('aint_man', 1);
    state.phase = 'KNOCKDOWN_COUNT';
    state.referee.downFighter = 'OPPONENT';
    state.referee.count = 4;
    state.referee.targetGetUpCount = 5;
    state.referee.countFrameCounter = REFEREE.FRAMES_PER_COUNT - 1; // 1 frame before next count tick
    state.opponent.action = 'KNOCKED_DOWN';

    state = step(state, {});
    expect(state.referee.count).toBe(5);
    expect(state.phase).toBe('ROUND_ACTIVE');
    expect(state.opponent.action).toBe('IDLE');
    expect(state.opponent.hp).toBe(Math.floor(state.opponent.maxHp * 0.4));
    expect(state.referee.downFighter).toBeNull();
  });

  // Task 010 Requirement 7: the down fighter's actionFrame advances during KNOCKDOWN_COUNT
  // so the renderer's fall progress (fallDy) actually grows while the referee counts.
  it('R7: down fighter actionFrame advances >= 31 while phase stays KNOCKDOWN_COUNT (opponent)', () => {
    let state = createFight('aint_man', 1);
    state.opponent.hp = 5;
    state.opponent.action = 'IDLE';
    state.opponent.guard = 'LOW';

    state = step(state, { punchLeftHead: true });
    expect(state.phase).toBe('KNOCKDOWN_COUNT');
    expect(state.opponent.action).toBe('KNOCKED_DOWN');
    expect(state.opponent.actionFrame).toBe(0);

    for (let f = 0; f < 31; f++) {
      state = step(state, {});
    }
    expect(state.phase).toBe('KNOCKDOWN_COUNT');
    expect(state.opponent.actionFrame).toBeGreaterThanOrEqual(31);
  });

  it('R7: down player actionFrame advances >= 31 while phase stays KNOCKDOWN_COUNT', () => {
    let state = createFight('aint_man', 1);
    state.phase = 'KNOCKDOWN_COUNT';
    state.referee.downFighter = 'PLAYER';
    state.referee.count = 0;
    state.referee.countFrameCounter = 0;
    state.player.action = 'KNOCKED_DOWN';
    state.player.actionFrame = 0;

    for (let f = 0; f < 31; f++) {
      state = step(state, {});
    }
    expect(state.phase).toBe('KNOCKDOWN_COUNT');
    expect(state.player.actionFrame).toBeGreaterThanOrEqual(31);
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
    for (let i = 0; i < ROUNDS.BETWEEN_ROUND_MIN_FRAMES; i++) {
      state = step(state, {});
    }
    state = step(state, { start: true });
    expect(state.round).toBe(2);
    expect(state.phase).toBe('ROUND_ACTIVE');
  });

  // Task 002 Requirement 7:
  // after round 1 ends player's hp rises and hearts reset to opponent's starting count;
  // after round 3 with no KO result === 'DECISION' and winner follows points table (one case player ahead, one opponent ahead)
  it('between rounds heals HP and resets hearts, decision winner follows points table', () => {
    // 1. Between rounds heal and hearts reset
    let sHeal = createFight('aint_man', 1);
    const initialHearts = ROSTER_SPECS.aint_man.initialHearts;
    sHeal.player.hp = 20;
    sHeal.player.hearts = 1;
    sHeal.phase = 'BETWEEN_ROUNDS';
    sHeal.roundFrame = ROUNDS.BETWEEN_ROUND_MIN_FRAMES;

    sHeal = step(sHeal, { start: true });
    expect(sHeal.round).toBe(2);
    expect(sHeal.phase).toBe('ROUND_ACTIVE');
    expect(sHeal.player.hp).toBe(20 + Math.floor(sHeal.player.maxHp * ROUNDS.BETWEEN_ROUND_HEAL_RATIO));
    expect(sHeal.player.hearts).toBe(initialHearts);

    // 2. Decision with player points ahead
    let sDecWin = createFight('aint_man', 1);
    sDecWin.round = 3;
    sDecWin.gameClockSeconds = 1;
    sDecWin.roundFrame = 59;
    sDecWin.player.points = 2000; // Above benchmark (1200)

    sDecWin = step(sDecWin, {});
    expect(sDecWin.phase).toBe('MATCH_OVER');
    expect(sDecWin.result).toBe('DECISION');
    expect(sDecWin.winner).toBe('PLAYER');

    // 3. Decision with opponent ahead / player points below benchmark
    let sDecLoss = createFight('aint_man', 1);
    sDecLoss.round = 3;
    sDecLoss.gameClockSeconds = 1;
    sDecLoss.roundFrame = 59;
    sDecLoss.player.points = 100; // Below benchmark (1200)

    sDecLoss = step(sDecLoss, {});
    expect(sDecLoss.phase).toBe('MATCH_OVER');
    expect(sDecLoss.result).toBe('DECISION');
    expect(sDecLoss.winner).toBe('OPPONENT');
  });

  // Task 003 Requirement 14 (M14): between-round transition resets isExhausted to false
  it('R9 between-round transition resets player isExhausted to false', () => {
    let state = createFight('aint_man', 1);
    state.phase = 'BETWEEN_ROUNDS';
    state.roundFrame = ROUNDS.BETWEEN_ROUND_MIN_FRAMES;
    state.player.isExhausted = true;
    state.player.hearts = 0;

    state = step(state, { start: true });
    expect(state.phase).toBe('ROUND_ACTIVE');
    expect(state.player.isExhausted).toBe(false);
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

  // Task 002 Requirement 8:
  // with createFight('aint_man', seed) and no forced state, stepping with empty input for up to 3000 frames
  // across several seeds produces at least one SPECIAL_ACTIVATED event with feedback BOUNTYGATE! and
  // an opponent attack sequence JAB, HOOK, UPPERCUT
  it('aint_man naturally triggers BOUNTYGATE special with JAB, HOOK, UPPERCUT combo within 3000 frames', () => {
    let triggered = false;
    const seeds = [1, 2, 3, 4, 42, 99, 123];

    for (const seed of seeds) {
      let state = createFight('aint_man', seed);
      for (let f = 0; f < 3000; f++) {
        state = step(state, {});
        if (state.events.includes('SPECIAL_ACTIVATED') && state.feedbackMessage === 'BOUNTYGATE!') {
          // The current action is TELL_JAB_LEFT, and the remaining queue is HOOK_RIGHT, UPPERCUT_LEFT
          expect(state.opponent.action).toBe('TELL_JAB_LEFT');
          expect(state.opponent.aiQueue).toEqual(['HOOK_RIGHT', 'UPPERCUT_LEFT']);

          // Advance through the attacks and record the sequence of executed moves
          const attackSequence: string[] = ['JAB'];
          for (let stepCount = 0; stepCount < 200; stepCount++) {
            state = step(state, {});
            if (state.opponent.action === 'TELL_HOOK_RIGHT' && attackSequence.length === 1) {
              attackSequence.push('HOOK');
            } else if (state.opponent.action === 'TELL_UPPERCUT_LEFT' && attackSequence.length === 2) {
              attackSequence.push('UPPERCUT');
              break;
            }
          }
          expect(attackSequence).toEqual(['JAB', 'HOOK', 'UPPERCUT']);
          triggered = true;
          break;
        }
      }
      if (triggered) break;
    }

    expect(triggered).toBe(true);
  });

  describe('Opponent TAUNT emission and punishability (Task 009 Req 12)', () => {
    const rosterIds = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'] as const;

    it.each(rosterIds)('opponent %s emits TAUNT within a round and lasts <= 60 frames', (oppId) => {
      let state = createFight(oppId, 42);
      let sawTaunt = false;
      let tauntDuration = 0;

      for (let f = 0; f < 1000; f++) {
        state = step(state, {});
        if (state.opponent.action === 'TAUNT') {
          sawTaunt = true;
          tauntDuration = state.opponent.actionDuration;
          break;
        }
      }

      expect(sawTaunt).toBe(true);
      expect(tauntDuration).toBeLessThanOrEqual(60);
    });

    it('TAUNT is punishable like recovery and grants counter hit / stun', () => {
      let state = createFight('aint_man', 42);
      state.opponent.action = 'TAUNT';
      state.opponent.actionDuration = 45;
      state.opponent.actionFrame = 10;
      const initialHp = state.opponent.hp;

      // Player punches opponent during TAUNT
      state = step(state, { punchLeftHead: true });

      expect(state.events).toContain('COUNTER');
      expect(state.opponent.action).toBe('STUNNED');
      expect(state.opponent.hp).toBeLessThan(initialHp);
    });
  });

  describe('Task 015 Requirement 3 & 5: Fight feel core engine tests', () => {
    it('Requirement 5: 5000 frames with no start stay in BETWEEN_ROUNDS', () => {
      let state = createFight('aint_man', 123);
      state.phase = 'BETWEEN_ROUNDS';
      state.roundFrame = 0;

      for (let i = 0; i < 5000; i++) {
        state = step(state, {});
      }

      expect(state.phase).toBe('BETWEEN_ROUNDS');
      expect(state.round).toBe(1);
      expect(state.roundFrame).toBe(5000);
    });

    it('Requirement 5: start at frame 30 does nothing, start at frame 60 enters round 2 with same healing', () => {
      let state = createFight('aint_man', 123);
      state.player.hp = 20;
      state.player.hearts = 1;
      state.phase = 'BETWEEN_ROUNDS';
      state.roundFrame = 0;

      // Advance 29 frames with no start
      for (let i = 0; i < 29; i++) {
        state = step(state, {});
      }
      expect(state.roundFrame).toBe(29);

      // Press start at frame 30 -> does nothing
      state = step(state, { start: true });
      expect(state.roundFrame).toBe(30);
      expect(state.phase).toBe('BETWEEN_ROUNDS');
      expect(state.round).toBe(1);
      expect(state.player.hp).toBe(20);

      // Advance to frame 59 with no start
      for (let i = 30; i < 59; i++) {
        state = step(state, {});
      }
      expect(state.roundFrame).toBe(59);

      // Press start at frame 60 -> enters round 2 with healing
      state = step(state, { start: true });
      expect(state.phase).toBe('ROUND_ACTIVE');
      expect(state.round).toBe(2);
      expect(state.roundFrame).toBe(0);
      const expectedHealed = Math.floor(state.player.maxHp * ROUNDS.BETWEEN_ROUND_HEAL_RATIO);
      expect(state.player.hp).toBe(20 + expectedHealed);
      expect(state.player.hearts).toBe(ROSTER_SPECS.aint_man.initialHearts);
    });

    it('Requirement 3: lastHitSide/lastHitTarget are render-only; 3 seeded 3000-frame fights per opponent are identical with fields stripped', () => {
      const rosterIds = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'] as const;
      const seeds = [42, 1337, 9999];

      for (const oppId of rosterIds) {
        for (const seed of seeds) {
          // Run 1: normal execution with lastHitSide and lastHitTarget populated
          let s1 = createFight(oppId, seed);
          const trace1: string[] = [];

          // Run 2: execution where lastHitSide and lastHitTarget are stripped after every frame
          let s2 = createFight(oppId, seed);
          delete s2.opponent.lastHitSide;
          delete s2.opponent.lastHitTarget;
          const trace2: string[] = [];

          for (let f = 0; f < 3000; f++) {
            // Generate some deterministic inputs
            const inp: InputFrame = {};
            if (f % 40 === 0) inp.punchLeftHead = true;
            if (f % 55 === 0) inp.punchRightBody = true;
            if (f % 90 === 0) inp.starPunch = true;
            if (f % 30 === 0) inp.dodgeLeft = true;
            if (f % 70 === 0) inp.duck = true;

            s1 = step(s1, inp);
            s2 = step(s2, inp);

            // Strip render-only fields from s2
            delete s2.opponent.lastHitSide;
            delete s2.opponent.lastHitTarget;

            trace1.push(`${s1.player.hp},${s1.player.hearts},${s1.player.points},${s1.opponent.hp}`);
            trace2.push(`${s2.player.hp},${s2.player.hearts},${s2.player.points},${s2.opponent.hp}`);
          }

          expect(trace1).toEqual(trace2);
        }
      }
    });

    it('Task 016 Requirement 6 (M2): step() sets opponent.lastHitSide and lastHitTarget on landed head and body hits', () => {
      // 1. Left head punch lands on opponent
      let fightHead = createFight('aint_man', 42);
      fightHead.phase = 'ROUND_ACTIVE';
      fightHead.opponent.action = 'IDLE';
      fightHead.opponent.guard = 'LOW'; // Low guard so head punch lands

      let landedHead = false;
      for (let i = 0; i < 20; i++) {
        fightHead = step(fightHead, i === 0 ? { punchLeftHead: true } : {});
        if (fightHead.opponent.action === 'HIT') {
          landedHead = true;
          expect(fightHead.opponent.lastHitSide, 'lastHitSide is LEFT for left head punch').toBe('LEFT');
          expect(fightHead.opponent.lastHitTarget, 'lastHitTarget is HEAD for left head punch').toBe('HEAD');
          break;
        }
      }
      expect(landedHead, 'left head punch landed').toBe(true);

      // 2. Right body punch lands on opponent
      let fightBody = createFight('aint_man', 42);
      fightBody.phase = 'ROUND_ACTIVE';
      fightBody.opponent.action = 'IDLE';
      fightBody.opponent.guard = 'HIGH'; // High guard so body punch lands

      let landedBody = false;
      for (let i = 0; i < 20; i++) {
        fightBody = step(fightBody, i === 0 ? { punchRightBody: true } : {});
        if (fightBody.opponent.action === 'HIT') {
          landedBody = true;
          expect(fightBody.opponent.lastHitSide, 'lastHitSide is RIGHT for right body punch').toBe('RIGHT');
          expect(fightBody.opponent.lastHitTarget, 'lastHitTarget is BODY for right body punch').toBe('BODY');
          break;
        }
      }
      expect(landedBody, 'right body punch landed').toBe(true);
    });

    // Task 017 Requirement 6 (M2): landed punchLeftBody must give lastHitSide === 'LEFT', lastHitTarget === 'BODY'
    it('Task 017 Requirement 6 (M2): landed punchLeftBody gives lastHitSide === LEFT and lastHitTarget === BODY', () => {
      let fight = createFight('aint_man', 42);
      fight.phase = 'ROUND_ACTIVE';
      fight.opponent.action = 'IDLE';
      fight.opponent.guard = 'HIGH'; // High guard so body punch lands

      let landed = false;
      for (let i = 0; i < 20; i++) {
        fight = step(fight, i === 0 ? { punchLeftBody: true } : {});
        if (fight.opponent.action === 'HIT') {
          landed = true;
          expect(fight.opponent.lastHitSide, 'lastHitSide is LEFT for punchLeftBody').toBe('LEFT');
          expect(fight.opponent.lastHitTarget, 'lastHitTarget is BODY for punchLeftBody').toBe('BODY');
          break;
        }
      }
      expect(landed, 'punchLeftBody landed').toBe(true);
    });

    // Task 017 Requirement 6 (M3): landed star punch must give lastHitSide === 'RIGHT', lastHitTarget === 'HEAD'
    it('Task 017 Requirement 6 (M3): landed starPunch gives lastHitSide === RIGHT and lastHitTarget === HEAD', () => {
      let fight = createFight('aint_man', 42);
      fight.phase = 'ROUND_ACTIVE';
      fight.player.stars = 1;
      fight.opponent.action = 'IDLE';
      fight.opponent.guard = 'LOW'; // Low guard so star punch lands

      let landed = false;
      for (let i = 0; i < 25; i++) {
        fight = step(fight, i === 0 ? { starPunch: true } : {});
        if (fight.opponent.action === 'HIT') {
          landed = true;
          expect(fight.opponent.lastHitSide, 'lastHitSide is RIGHT for starPunch').toBe('RIGHT');
          expect(fight.opponent.lastHitTarget, 'lastHitTarget is HEAD for starPunch').toBe('HEAD');
          break;
        }
      }
      expect(landed, 'starPunch landed').toBe(true);
    });
  });
});
