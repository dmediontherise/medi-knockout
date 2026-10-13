import {
  FightState,
  InputFrame,
  SoundEvent,
  AttackType,
  ActionType,
  OpponentActionType,
} from './types';
import {
  FPS,
  PLAYER_DURATIONS,
  OPPONENT_ATTACKS,
  OPPONENT_DURATIONS,
  HEARTS,
  STARS,
  COMBAT,
  REFEREE,
  ROUNDS,
  POINTS,
  ROSTER_SPECS,
} from './constants';

// Pure deterministic LCG PRNG
export function nextRandom(seed: number): { value: number; nextSeed: number } {
  // LCG parameters (Numerical Recipes)
  const nextSeed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  const value = nextSeed / 0x100000000;
  return { value, nextSeed };
}

export function createFight(opponentId: string, seed: number): FightState {
  const spec = ROSTER_SPECS[opponentId] || ROSTER_SPECS.aint_man;

  return {
    frame: 0,
    seed: seed >>> 0,
    opponentId: spec.id,
    phase: 'ROUND_ACTIVE',
    round: 1,
    roundFrame: 0,
    gameClockSeconds: ROUNDS.ROUND_DURATION_GAME_SECONDS,
    result: 'IN_PROGRESS',
    winner: null,

    player: {
      hp: 100,
      maxHp: 100,
      hearts: spec.initialHearts,
      maxHearts: spec.initialHearts,
      stars: 0,
      action: 'IDLE',
      actionFrame: 0,
      actionDuration: 0,
      isExhausted: false,
      knockdownsThisRound: 0,
      totalKnockdowns: 0,
      points: 0,
      hitsLanded: 0,
    },

    opponent: {
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      action: 'IDLE',
      actionFrame: 0,
      actionDuration: 0,
      guard: 'HIGH',
      starOpportunity: false,
      knockdownsThisRound: 0,
      totalKnockdowns: 0,
      aiQueue: ['TAUNT'],
      aiWaitFrames: 45, // brief delay before first attack
      patternIndex: 0,
      lastTellAttack: null,
    },

    specialState: {
      djTitoInvertedFrames: 0,
      magaManBigLieFrames: 0,
      mediJinxBookItCharges: 0,
      mrYankeePinstripeCharges: 0,
    },

    referee: {
      count: 0,
      countFrameCounter: 0,
      downFighter: null,
      targetGetUpCount: 0,
      playerMashCount: 0,
    },

    events: [],
    feedbackMessage: null,
  };
}

function parseAttack(actionName: string): { type: AttackType; isLeft: boolean } | null {
  if (actionName.includes('JAB')) {
    return { type: 'JAB', isLeft: actionName.includes('LEFT') };
  }
  if (actionName.includes('HOOK')) {
    return { type: 'HOOK', isLeft: actionName.includes('LEFT') };
  }
  if (actionName.includes('UPPERCUT')) {
    return { type: 'UPPERCUT', isLeft: actionName.includes('LEFT') };
  }
  return null;
}

function getTellFrames(spec: typeof ROSTER_SPECS['aint_man'], attack: AttackType, round: number): number {
  const base = spec.baseTells[attack];
  // Speed up by 4 frames per round after round 1, never below 12 frames
  const reduction = (round - 1) * 4;
  return Math.max(12, base - reduction);
}

function isPlayerEvading(action: ActionType, actionFrame: number): { evading: boolean; type: 'DODGE' | 'DUCK' | 'BLOCK' | 'NONE' } {
  if (action === 'DODGE_LEFT' || action === 'DODGE_RIGHT') {
    if (actionFrame >= PLAYER_DURATIONS.DODGE_INVULN_START && actionFrame <= PLAYER_DURATIONS.DODGE_INVULN_END) {
      return { evading: true, type: 'DODGE' };
    }
  }
  if (action === 'DUCK') {
    if (actionFrame >= PLAYER_DURATIONS.DUCK_INVULN_START && actionFrame <= PLAYER_DURATIONS.DUCK_INVULN_END) {
      return { evading: true, type: 'DUCK' };
    }
  }
  if (action === 'BLOCK') {
    return { evading: true, type: 'BLOCK' };
  }
  return { evading: false, type: 'NONE' };
}

export function step(state: FightState, input: InputFrame): FightState {
  // If match over, freeze state
  if (state.phase === 'MATCH_OVER') {
    return state;
  }

  // Clone top-level and nested state shallowly / appropriately
  const next: FightState = {
    ...state,
    frame: state.frame + 1,
    events: [],
    feedbackMessage: null,
    player: { ...state.player },
    opponent: { ...state.opponent },
    specialState: { ...state.specialState },
    referee: { ...state.referee },
  };

  const spec = ROSTER_SPECS[next.opponentId] || ROSTER_SPECS.aint_man;

  // Decrease special state frame timers if active
  if (next.specialState.djTitoInvertedFrames > 0) {
    next.specialState.djTitoInvertedFrames--;
  }
  if (next.specialState.magaManBigLieFrames > 0) {
    next.specialState.magaManBigLieFrames--;
  }

  // Inverted controls for DJ Tito special
  let effectiveInput = input;
  if (next.specialState.djTitoInvertedFrames > 0) {
    effectiveInput = {
      ...input,
      dodgeLeft: input.dodgeRight,
      dodgeRight: input.dodgeLeft,
      punchLeftHead: input.punchRightHead,
      punchRightHead: input.punchLeftHead,
      punchLeftBody: input.punchRightBody,
      punchRightBody: input.punchLeftBody,
    };
  }

  // ==========================================
  // PHASE: BETWEEN ROUNDS
  // ==========================================
  if (next.phase === 'BETWEEN_ROUNDS') {
    next.roundFrame++;
    if (next.roundFrame >= ROUNDS.BETWEEN_ROUND_FRAMES) {
      // Start next round
      next.round++;
      next.phase = 'ROUND_ACTIVE';
      next.roundFrame = 0;
      next.gameClockSeconds = ROUNDS.ROUND_DURATION_GAME_SECONDS;
      next.player.knockdownsThisRound = 0;
      next.opponent.knockdownsThisRound = 0;
      // Regain HP and reset hearts
      const healed = Math.floor(next.player.maxHp * ROUNDS.BETWEEN_ROUND_HEAL_RATIO);
      next.player.hp = Math.min(next.player.maxHp, next.player.hp + healed);
      next.player.hearts = next.player.maxHearts;
      next.player.isExhausted = false;
      next.events.push('BELL');
      next.feedbackMessage = `ROUND ${next.round}!`;
    }
    return next;
  }

  // ==========================================
  // PHASE: KNOCKDOWN COUNT (Referee)
  // ==========================================
  if (next.phase === 'KNOCKDOWN_COUNT') {
    next.referee.countFrameCounter++;

    // Process player mash input if player is down
    if (next.referee.downFighter === 'PLAYER' && effectiveInput.mash) {
      next.referee.playerMashCount++;
      if (next.referee.playerMashCount >= next.referee.targetGetUpCount) {
        // Player gets up!
        next.phase = 'ROUND_ACTIVE';
        next.player.action = 'IDLE';
        next.player.actionFrame = 0;
        next.player.actionDuration = 0;
        next.player.hp = Math.floor(next.player.maxHp * 0.35); // restore partial HP
        next.player.hearts = Math.max(3, next.player.hearts);
        next.player.isExhausted = false;
        next.referee.downFighter = null;
        next.events.push('GET_UP');
        next.feedbackMessage = 'GET UP!';
        return next;
      }
    }

    if (next.referee.countFrameCounter >= REFEREE.FRAMES_PER_COUNT) {
      next.referee.countFrameCounter = 0;
      next.referee.count++;
      next.events.push('COUNT');

      // Check if Opponent gets up
      if (next.referee.downFighter === 'OPPONENT') {
        if (next.referee.count >= next.referee.targetGetUpCount && next.referee.targetGetUpCount <= REFEREE.MAX_COUNT) {
          // Opponent gets up
          next.phase = 'ROUND_ACTIVE';
          next.opponent.action = 'IDLE';
          next.opponent.actionFrame = 0;
          next.opponent.actionDuration = 0;
          next.opponent.hp = Math.floor(next.opponent.maxHp * 0.4);
          next.opponent.aiWaitFrames = 30;
          next.referee.downFighter = null;
          next.events.push('GET_UP');
          next.feedbackMessage = 'FIGHT!';
          return next;
        }
      }

      // Check KO (count reached 10)
      if (next.referee.count >= REFEREE.MAX_COUNT) {
        next.phase = 'MATCH_OVER';
        next.result = 'KO';
        next.winner = next.referee.downFighter === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
        next.events.push('KO');
        next.feedbackMessage = next.winner === 'PLAYER' ? 'KNOCKOUT! YOU WIN!' : 'KO! YOU LOSE!';
        return next;
      }
    }
    return next;
  }

  // ==========================================
  // PHASE: ROUND ACTIVE - Advance Clock
  // ==========================================
  next.roundFrame++;
  if (next.roundFrame % ROUNDS.FRAMES_PER_GAME_SECOND === 0) {
    if (next.gameClockSeconds > 0) {
      next.gameClockSeconds--;
    }
    if (next.gameClockSeconds <= 0) {
      // Round ends
      if (next.round < ROUNDS.TOTAL_ROUNDS) {
        next.phase = 'BETWEEN_ROUNDS';
        next.roundFrame = 0;
        next.events.push('BELL');
        next.feedbackMessage = 'ROUND OVER';
        return next;
      } else {
        // End of round 3: Decision
        next.phase = 'MATCH_OVER';
        next.result = 'DECISION';
        // Player wins decision if points threshold or player points > opponent benchmark
        const benchmark = 1200;
        next.winner = next.player.points >= benchmark ? 'PLAYER' : 'OPPONENT';
        next.events.push('BELL');
        next.feedbackMessage = next.winner === 'PLAYER' ? 'DECISION WIN!' : 'DECISION LOSS!';
        return next;
      }
    }
  }

  // ==========================================
  // 1. ADVANCE PLAYER ACTION
  // ==========================================
  let playerJustPunched = false;
  let punchType: 'HEAD' | 'BODY' | 'STAR' | null = null;

  if (next.player.action !== 'IDLE') {
    next.player.actionFrame++;

    if (next.player.action === 'BLOCK') {
      // Continues as long as block input is held
      if (!effectiveInput.block && next.player.actionFrame >= PLAYER_DURATIONS.BLOCK_MIN) {
        next.player.action = 'IDLE';
        next.player.actionFrame = 0;
        next.player.actionDuration = 0;
      }
    } else if (next.player.actionFrame >= next.player.actionDuration) {
      // Finished action -> return to IDLE
      next.player.action = 'IDLE';
      next.player.actionFrame = 0;
      next.player.actionDuration = 0;
    }
  }

  // If IDLE, accept player input
  if (next.player.action === 'IDLE') {
    if (effectiveInput.dodgeLeft) {
      next.player.action = 'DODGE_LEFT';
      next.player.actionDuration = PLAYER_DURATIONS.DODGE;
      next.player.actionFrame = 0;
      next.events.push('DODGE');
    } else if (effectiveInput.dodgeRight) {
      next.player.action = 'DODGE_RIGHT';
      next.player.actionDuration = PLAYER_DURATIONS.DODGE;
      next.player.actionFrame = 0;
      next.events.push('DODGE');
    } else if (effectiveInput.duck) {
      next.player.action = 'DUCK';
      next.player.actionDuration = PLAYER_DURATIONS.DUCK;
      next.player.actionFrame = 0;
    } else if (effectiveInput.block) {
      next.player.action = 'BLOCK';
      next.player.actionDuration = PLAYER_DURATIONS.BLOCK_MIN;
      next.player.actionFrame = 0;
    } else if (effectiveInput.starPunch && next.player.stars > 0 && !next.player.isExhausted) {
      next.player.action = 'STAR_PUNCH';
      next.player.actionDuration = PLAYER_DURATIONS.STAR_PUNCH;
      next.player.actionFrame = 0;
      next.player.stars -= STARS.CONSUMPTION;
      next.events.push('STAR_PUNCH');
      playerJustPunched = true;
      punchType = 'STAR';
    } else if (!next.player.isExhausted) {
      if (effectiveInput.punchLeftHead) {
        next.player.action = 'PUNCH_LEFT_HEAD';
        next.player.actionDuration = PLAYER_DURATIONS.PUNCH;
        next.player.actionFrame = 0;
        playerJustPunched = true;
        punchType = 'HEAD';
      } else if (effectiveInput.punchRightHead) {
        next.player.action = 'PUNCH_RIGHT_HEAD';
        next.player.actionDuration = PLAYER_DURATIONS.PUNCH;
        next.player.actionFrame = 0;
        playerJustPunched = true;
        punchType = 'HEAD';
      } else if (effectiveInput.punchLeftBody) {
        next.player.action = 'PUNCH_LEFT_BODY';
        next.player.actionDuration = PLAYER_DURATIONS.PUNCH;
        next.player.actionFrame = 0;
        playerJustPunched = true;
        punchType = 'BODY';
      } else if (effectiveInput.punchRightBody) {
        next.player.action = 'PUNCH_RIGHT_BODY';
        next.player.actionDuration = PLAYER_DURATIONS.PUNCH;
        next.player.actionFrame = 0;
        playerJustPunched = true;
        punchType = 'BODY';
      }
    }
  }

  // ==========================================
  // 2. ADVANCE OPPONENT ACTION
  // ==========================================
  let opponentHitConnectFrame = false;
  let opponentAttackType: AttackType | null = null;

  if (next.opponent.action !== 'IDLE') {
    next.opponent.actionFrame++;

    // Check transition from TELL to PUNCH
    if (next.opponent.action.startsWith('TELL_')) {
      if (next.opponent.actionFrame >= next.opponent.actionDuration) {
        // Transition to active punch
        const tellType = next.opponent.action.replace('TELL_', 'PUNCH_') as OpponentActionType;
        const attackMeta = parseAttack(next.opponent.action);
        if (attackMeta) {
          const attackConfig = OPPONENT_ATTACKS[attackMeta.type];
          next.opponent.action = tellType;
          next.opponent.actionDuration = attackConfig.activeFrames + attackConfig.recoveryFrames;
          next.opponent.actionFrame = 0;
          next.opponent.lastTellAttack = attackMeta.type;
          next.events.push('SWING');
        }
      }
    } else if (next.opponent.action.startsWith('PUNCH_')) {
      const attackMeta = parseAttack(next.opponent.action);
      if (attackMeta) {
        const attackConfig = OPPONENT_ATTACKS[attackMeta.type];
        // Punch hits on active frame
        if (next.opponent.actionFrame === attackConfig.activeFrames) {
          opponentHitConnectFrame = true;
          opponentAttackType = attackMeta.type;
        }
        // Star opportunity in recovery frames right after attack is evaded
        if (next.opponent.actionFrame > attackConfig.activeFrames) {
          next.opponent.starOpportunity = true;
        }
      }

      if (next.opponent.actionFrame >= next.opponent.actionDuration) {
        // Attack finished
        next.opponent.action = 'IDLE';
        next.opponent.actionFrame = 0;
        next.opponent.actionDuration = 0;
        next.opponent.starOpportunity = false;
        next.opponent.aiWaitFrames = 15;
      }
    } else if (next.opponent.actionFrame >= next.opponent.actionDuration) {
      // Other actions (HIT, STUNNED, BLOCK) finished
      next.opponent.action = 'IDLE';
      next.opponent.actionFrame = 0;
      next.opponent.actionDuration = 0;
      next.opponent.starOpportunity = false;
      next.opponent.aiWaitFrames = 10;
    }
  }

  // ==========================================
  // 3. AI DECISION MAKING (when IDLE)
  // ==========================================
  if (next.opponent.action === 'IDLE') {
    if (next.opponent.aiWaitFrames > 0) {
      next.opponent.aiWaitFrames--;
    } else {
      // Pick next move from queue or select combo / special
      if (next.opponent.aiQueue.length === 0) {
        const rng = nextRandom(next.seed);
        next.seed = rng.nextSeed;
        const randVal = rng.value;

        // Check specials
        if (spec.specialId === 'bountygate' && randVal < 0.35) {
          // Aint Man Bountygate 3-punch combo
          next.opponent.aiQueue = ['JAB_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT'];
          next.feedbackMessage = 'BOUNTYGATE!';
          next.events.push('SPECIAL_ACTIVATED');
        } else if (spec.specialId === 'book_it' && randVal < 0.4) {
          // Medi Jinx Book-It speed/damage
          next.opponent.aiQueue = ['UPPERCUT_LEFT'];
          next.specialState.mediJinxBookItCharges = 1;
          next.feedbackMessage = 'BOOK IT!';
          next.events.push('SPECIAL_ACTIVATED');
        } else if (spec.specialId === 'run_it_back' && randVal < 0.35 && next.specialState.djTitoInvertedFrames === 0) {
          // DJ Tito Run It Back inverted controls
          next.specialState.djTitoInvertedFrames = 180; // 3 seconds
          next.opponent.aiQueue = ['JAB_LEFT', 'HOOK_RIGHT'];
          next.feedbackMessage = 'RUN IT BACK!';
          next.events.push('SPECIAL_ACTIVATED');
        } else if (spec.specialId === 'pinstripe' && randVal < 0.35) {
          // Mr Yankee Pinstripe combo (5 hit combo)
          next.opponent.aiQueue = ['HOOK_LEFT', 'HOOK_RIGHT', 'UPPERCUT_LEFT', 'UPPERCUT_RIGHT', 'HOOK_LEFT'];
          next.specialState.mrYankeePinstripeCharges = 5;
          next.feedbackMessage = 'PINSTRIPE!';
          next.events.push('SPECIAL_ACTIVATED');
        } else if (spec.specialId === 'big_lie' && randVal < 0.35 && next.specialState.magaManBigLieFrames === 0) {
          // MAGA Man Big Lie self-damage mode
          next.specialState.magaManBigLieFrames = 180;
          next.feedbackMessage = 'BIG LIE!';
          next.events.push('SPECIAL_ACTIVATED');
        } else {
          // Standard combo from list
          const comboIdx = Math.floor(randVal * spec.combos.length);
          next.opponent.aiQueue = [...spec.combos[comboIdx]];
        }

        // Taunt requirement: opponent emits TAUNT at least once per round
        // Append TAUNT after combo with 30% chance or if time in round is passing and no taunt yet
        const rngTaunt = nextRandom(next.seed);
        next.seed = rngTaunt.nextSeed;
        if (rngTaunt.value < 0.35 || next.roundFrame > 300) {
          if (!next.opponent.aiQueue.includes('TAUNT')) {
            next.opponent.aiQueue.push('TAUNT');
          }
        }
      }

      // Dequeue next move
      const nextMove = next.opponent.aiQueue.shift();
      if (nextMove) {
        if (nextMove === 'TAUNT') {
          next.opponent.action = 'TAUNT';
          next.opponent.actionDuration = 45; // <= 60 frames
          next.opponent.actionFrame = 0;
          next.opponent.starOpportunity = true;
        } else if (nextMove.startsWith('BLOCK_')) {
          next.opponent.action = nextMove as OpponentActionType;
          next.opponent.actionDuration = OPPONENT_DURATIONS.BLOCK;
          next.opponent.actionFrame = 0;
          next.opponent.guard = nextMove === 'BLOCK_HIGH' ? 'HIGH' : 'LOW';
        } else {
          // It is an attack move like 'JAB_LEFT', 'HOOK_RIGHT', etc.
          const attackMeta = parseAttack(nextMove);
          if (attackMeta) {
            const tellAction = `TELL_${nextMove}` as OpponentActionType;
            let tellFrames = getTellFrames(spec, attackMeta.type, next.round);
            if (next.specialState.mediJinxBookItCharges > 0) {
              tellFrames = Math.max(12, Math.floor(tellFrames * 0.4));
            }
            next.opponent.action = tellAction;
            next.opponent.actionDuration = tellFrames;
            next.opponent.actionFrame = 0;
            // Star opportunity tell: per character tell window
            const rngTell = nextRandom(next.seed);
            next.seed = rngTell.nextSeed;
            next.opponent.starOpportunity = rngTell.value < 0.5;
          }
        }
      }
    }
  }

  // ==========================================
  // 4. RESOLVE PLAYER ATTACK HIT DETECTION
  // ==========================================
  if (playerJustPunched && punchType) {
    const isHead = punchType === 'HEAD';
    const isStar = punchType === 'STAR';

    // MAGA MAN BIG LIE: User punch causes self-damage
    if (next.specialState.magaManBigLieFrames > 0) {
      next.player.hp = Math.max(0, next.player.hp - 10);
      next.events.push('HIT_HEAD');
      next.feedbackMessage = 'FAKE NEWS!';

      if (next.player.hp <= 0) {
        // Player Knockdown
        return triggerPlayerKnockdown(next);
      }
    } else {
      // Normal attack against opponent
      const oppAction = next.opponent.action;
      const oppFrame = next.opponent.actionFrame;
      const isTell = oppAction.startsWith('TELL_');
      const isRecovery =
        oppAction === 'TAUNT' ||
        (oppAction.startsWith('PUNCH_') && oppFrame > OPPONENT_ATTACKS[parseAttack(oppAction)!.type].activeFrames);
      const isStunned = oppAction === 'STUNNED';
      const isBlocked =
        (oppAction === 'BLOCK_HIGH' && isHead) ||
        (oppAction === 'BLOCK_LOW' && !isHead && !isStar) ||
        (oppAction === 'IDLE' && ((next.opponent.guard === 'HIGH' && isHead) || (next.opponent.guard === 'LOW' && !isHead && !isStar)));

      if (isBlocked && !isStar && !isTell && !isRecovery && !isStunned) {
        // Blocked!
        next.player.hearts = Math.max(0, next.player.hearts - HEARTS.BLOCKED_PENALTY);
        if (next.player.hearts === 0) {
          next.player.isExhausted = true;
          next.events.push('EXHAUSTED');
        }
        next.events.push('HIT_BLOCK');
        next.feedbackMessage = 'BLOCKED!';
      } else {
        // Attack lands!
        next.player.hitsLanded++;
        let baseDmg = isStar
          ? STARS.STAR_PUNCH_DAMAGE
          : isHead
          ? COMBAT.PLAYER_HEAD_DAMAGE
          : COMBAT.PLAYER_BODY_DAMAGE;

        let isCounter = false;
        if (isTell || isRecovery) {
          baseDmg = Math.floor(baseDmg * COMBAT.COUNTER_MULTIPLIER);
          isCounter = true;
          next.events.push('COUNTER');
          next.player.points += POINTS.COUNTER_LANDED;
          next.feedbackMessage = 'COUNTER!';
        } else if (isStunned) {
          baseDmg = Math.floor(baseDmg * COMBAT.STUNNED_MULTIPLIER);
          next.player.points += isHead ? POINTS.JAB_LANDED : POINTS.BODY_LANDED;
        } else {
          next.player.points += isHead ? POINTS.JAB_LANDED : POINTS.BODY_LANDED;
        }

        if (isStar) {
          next.player.points += POINTS.STAR_PUNCH_LANDED;
          next.feedbackMessage = 'STAR PUNCH!';
        }

        // Star opportunity award: max 3 stars (only on regular punches)
        if (!isStar && next.opponent.starOpportunity && next.player.stars < STARS.MAX_STARS) {
          next.player.stars = Math.min(STARS.MAX_STARS, next.player.stars + 1);
          next.events.push('STAR_EARNED');
        }

        // Landing a punch +1 heart
        next.player.hearts = Math.min(next.player.maxHearts, next.player.hearts + HEARTS.PUNCH_LANDED_BONUS);

        // Apply damage to opponent
        next.opponent.hp = Math.max(0, next.opponent.hp - baseDmg);
        next.events.push(isHead ? 'HIT_HEAD' : 'HIT_BODY');

        // Opponent reaction
        if (isCounter) {
          next.opponent.action = 'STUNNED';
          next.opponent.actionDuration = OPPONENT_DURATIONS.STUNNED;
          next.opponent.actionFrame = 0;
          next.opponent.aiQueue = [];
        } else {
          next.opponent.action = 'HIT';
          next.opponent.actionDuration = OPPONENT_DURATIONS.HIT;
          next.opponent.actionFrame = 0;
        }

        // Check Opponent Knockdown
        if (next.opponent.hp <= 0) {
          return triggerOpponentKnockdown(next);
        }
      }
    }
  }

  // ==========================================
  // 5. RESOLVE OPPONENT ATTACK HIT DETECTION
  // ==========================================
  if (opponentHitConnectFrame && opponentAttackType) {
    const evadeStatus = isPlayerEvading(next.player.action, next.player.actionFrame);
    let avoided = false;
    let blocked = false;

    if (evadeStatus.type === 'DODGE') {
      // Dodge avoids jabs and hooks and uppercuts
      avoided = true;
    } else if (evadeStatus.type === 'DUCK') {
      // Duck avoids jabs and hooks, but NOT uppercuts
      if (opponentAttackType !== 'UPPERCUT') {
        avoided = true;
      }
    } else if (evadeStatus.type === 'BLOCK') {
      // Block stops jabs, but NOT hooks or uppercuts
      if (opponentAttackType === 'JAB') {
        blocked = true;
      }
    }

    if (avoided) {
      next.events.push('DODGE');
      next.feedbackMessage = 'DODGE!';
      // If player was exhausted, successful evasion restores hearts
      if (next.player.isExhausted) {
        next.player.hearts += HEARTS.EVADE_RECOVERY;
        if (next.player.hearts >= HEARTS.EXHAUSTION_RECOVERY_THRESHOLD) {
          next.player.isExhausted = false;
          next.feedbackMessage = 'READY!';
        }
      }
    } else if (blocked) {
      // Player blocks jab: chip damage, -1 heart
      next.player.hearts = Math.max(0, next.player.hearts - HEARTS.DEFEND_BLOCK_PENALTY);
      if (next.player.hearts === 0) {
        next.player.isExhausted = true;
        next.events.push('EXHAUSTED');
      }
      const rawDmg = OPPONENT_ATTACKS[opponentAttackType].damage * spec.power;
      const chipDmg = Math.max(1, Math.floor(rawDmg * COMBAT.BLOCK_CHIP_FACTOR));
      next.player.hp = Math.max(0, next.player.hp - chipDmg);
      next.events.push('HIT_BLOCK');
      next.feedbackMessage = 'BLOCKED!';

      if (next.player.hp <= 0) {
        return triggerPlayerKnockdown(next);
      }
    } else {
      // Player HIT!
      let damage = OPPONENT_ATTACKS[opponentAttackType].damage * spec.power;

      // Special multipliers
      if (next.specialState.mediJinxBookItCharges > 0) {
        damage *= 2.0;
        next.specialState.mediJinxBookItCharges = 0;
      }
      if (next.specialState.mrYankeePinstripeCharges > 0) {
        damage *= 2.0;
        next.specialState.mrYankeePinstripeCharges--;
      }

      next.player.hp = Math.max(0, next.player.hp - Math.floor(damage));
      next.player.action = 'HIT';
      next.player.actionDuration = PLAYER_DURATIONS.HIT;
      next.player.actionFrame = 0;

      // Hearts decrease by 3
      next.player.hearts = Math.max(0, next.player.hearts - HEARTS.HIT_PENALTY);
      if (next.player.hearts === 0) {
        next.player.isExhausted = true;
        next.events.push('EXHAUSTED');
      }

      // Being hit removes ALL stars
      next.player.stars = 0;

      next.events.push('HIT_HEAD');
      next.feedbackMessage = 'OUCH!';

      if (next.player.hp <= 0) {
        return triggerPlayerKnockdown(next);
      }
    }
  }

  return next;
}

function triggerPlayerKnockdown(next: FightState): FightState {
  next.player.knockdownsThisRound++;
  next.player.totalKnockdowns++;
  next.player.action = 'KNOCKED_DOWN';
  next.player.actionDuration = PLAYER_DURATIONS.KNOCKED_DOWN;
  next.player.actionFrame = 0;
  next.events.push('KNOCKDOWN');

  // Check 3 knockdowns in one round = TKO
  if (next.player.knockdownsThisRound >= REFEREE.MAX_KNOCKDOWNS_PER_ROUND_TKO) {
    next.phase = 'MATCH_OVER';
    next.result = 'TKO';
    next.winner = 'OPPONENT';
    next.events.push('TKO');
    next.feedbackMessage = 'TKO! YOU LOSE!';
    return next;
  }

  // Switch to knockdown referee count
  next.phase = 'KNOCKDOWN_COUNT';
  next.referee.count = 0;
  next.referee.countFrameCounter = 0;
  next.referee.downFighter = 'PLAYER';
  next.referee.playerMashCount = 0;
  next.referee.targetGetUpCount = REFEREE.MASHES_NEEDED_BASE;
  next.feedbackMessage = 'DOWN!';
  return next;
}

function triggerOpponentKnockdown(next: FightState): FightState {
  next.opponent.knockdownsThisRound++;
  next.opponent.totalKnockdowns++;
  next.opponent.action = 'KNOCKED_DOWN';
  next.opponent.actionDuration = OPPONENT_DURATIONS.KNOCKED_DOWN;
  next.opponent.actionFrame = 0;
  next.player.points += POINTS.KNOCKDOWN_OPPONENT;
  next.events.push('KNOCKDOWN');

  // Check 3 knockdowns in one round = TKO
  if (next.opponent.knockdownsThisRound >= REFEREE.MAX_KNOCKDOWNS_PER_ROUND_TKO) {
    next.phase = 'MATCH_OVER';
    next.result = 'TKO';
    next.winner = 'PLAYER';
    next.events.push('TKO');
    next.feedbackMessage = 'TKO! YOU WIN!';
    return next;
  }

  // Opponent gets up based on seeded logic
  const rng = nextRandom(next.seed);
  next.seed = rng.nextSeed;
  // Get up between count 3 and 8 if not TKO
  const targetCount = 3 + Math.floor(rng.value * 6); // 3..8

  next.phase = 'KNOCKDOWN_COUNT';
  next.referee.count = 0;
  next.referee.countFrameCounter = 0;
  next.referee.downFighter = 'OPPONENT';
  next.referee.targetGetUpCount = targetCount;
  next.feedbackMessage = 'DOWN!';
  return next;
}
