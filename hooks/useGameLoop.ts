import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, PlayerAction, OpponentAction, FighterStats, HitType } from '../types';
import { ROSTER } from '../constants';
import { soundEngine } from '../utils/sound';
import { createFight, step } from '../src/core/engine';
import { FightState, InputFrame, SoundEvent } from '../src/core/types';
import { ROUNDS } from '../src/core/constants';
import { hitStopFrames, bufferInput } from './hitStop';

// Helper to map engine ActionType to legacy PlayerAction
function mapPlayerAction(action: string): PlayerAction {
  switch (action) {
    case 'BLOCK':
      return PlayerAction.BLOCK;
    case 'DODGE_LEFT':
      return PlayerAction.DODGE_LEFT;
    case 'DODGE_RIGHT':
      return PlayerAction.DODGE_RIGHT;
    case 'DUCK':
      return PlayerAction.DUCK;
    case 'PUNCH_LEFT_BODY':
      return PlayerAction.PUNCH_LEFT_BODY;
    case 'PUNCH_RIGHT_BODY':
      return PlayerAction.PUNCH_RIGHT_BODY;
    case 'PUNCH_LEFT_HEAD':
      return PlayerAction.PUNCH_LEFT_HEAD;
    case 'PUNCH_RIGHT_HEAD':
      return PlayerAction.PUNCH_RIGHT_HEAD;
    case 'STAR_PUNCH':
      return PlayerAction.STAR_PUNCH;
    case 'HIT':
      return PlayerAction.HIT;
    case 'KNOCKED_DOWN':
    case 'KO':
      return PlayerAction.KO;
    default:
      return PlayerAction.IDLE;
  }
}

// Helper to map engine OpponentActionType to legacy OpponentAction
function mapOpponentAction(action: string): OpponentAction {
  switch (action) {
    case 'BLOCK_HIGH':
      return OpponentAction.BLOCK_HIGH;
    case 'BLOCK_LOW':
      return OpponentAction.BLOCK_LOW;
    case 'TELL_JAB_LEFT':
      return OpponentAction.TELEGRAPH_JAB_LEFT;
    case 'TELL_JAB_RIGHT':
      return OpponentAction.TELEGRAPH_JAB_RIGHT;
    case 'TELL_HOOK_LEFT':
      return OpponentAction.TELEGRAPH_HOOK_LEFT;
    case 'TELL_HOOK_RIGHT':
      return OpponentAction.TELEGRAPH_HOOK_RIGHT;
    case 'TELL_UPPERCUT_LEFT':
      return OpponentAction.TELEGRAPH_UPPERCUT_LEFT;
    case 'TELL_UPPERCUT_RIGHT':
      return OpponentAction.TELEGRAPH_UPPERCUT_RIGHT;
    case 'PUNCH_JAB_LEFT':
      return OpponentAction.PUNCH_JAB_LEFT;
    case 'PUNCH_JAB_RIGHT':
      return OpponentAction.PUNCH_JAB_RIGHT;
    case 'PUNCH_HOOK_LEFT':
      return OpponentAction.PUNCH_HOOK_LEFT;
    case 'PUNCH_HOOK_RIGHT':
      return OpponentAction.PUNCH_HOOK_RIGHT;
    case 'PUNCH_UPPERCUT_LEFT':
      return OpponentAction.PUNCH_UPPERCUT_LEFT;
    case 'PUNCH_UPPERCUT_RIGHT':
      return OpponentAction.PUNCH_UPPERCUT_RIGHT;
    case 'HIT':
      return OpponentAction.HIT;
    case 'STUNNED':
      return OpponentAction.STUNNED;
    case 'KNOCKED_DOWN':
    case 'KO':
      return OpponentAction.KO;
    default:
      return OpponentAction.IDLE;
  }
}

const FRAME_MS = 1000 / 60; // 16.666 ms per 1/60s frame

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [opponentIndex, setOpponentIndex] = useState(0);
  const currentOpponent = ROSTER[opponentIndex];

  // Engine state ref
  const engineStateRef = useRef<FightState>(createFight(currentOpponent.id, 12345));

  // Current inputs buffer for the next frame(s)
  const pendingInputRef = useRef<InputFrame>({});
  const bufferedInputRef = useRef<InputFrame>({});
  const hitStopCounterRef = useRef<number>(0);
  const isBlockHeldRef = useRef(false);

  // Transition timer (in integer frames)
  const transitionTimerRef = useRef<number>(0);
  const nextTransitionStateRef = useRef<GameState | null>(null);
  // ROUND_START sub-stage: 0 = "ROUND n", 1 = "READY?", 2 = "FIGHT!"
  const roundStartStageRef = useRef<number>(0);

  // Visual/Feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number>(0);
  const lastHitTypeRef = useRef<HitType>('NONE');

  // Time accumulator for fixed 1/60 s timestep
  const accumulatorRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

  // Auto-start match if ?debug=lowhp or ?debug=betweenrounds is provided on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug');
    const oppParam = params.get('opp');
    if (debug === 'lowhp') {
      resetGame(oppParam || 'aint_man');
    } else if (debug === 'betweenrounds') {
      const oppId = oppParam || 'aint_man';
      const foundIdx = ROSTER.findIndex((r) => r.id === oppId);
      const nextIdx = foundIdx !== -1 ? foundIdx : 0;
      setOpponentIndex(nextIdx);
      const fight = createFight(oppId, 12345);
      fight.phase = 'BETWEEN_ROUNDS';
      fight.round = 1;
      fight.player.hp = Math.floor(fight.player.maxHp * 0.7);
      fight.opponent.hp = Math.floor(fight.opponent.maxHp * 0.6);
      fight.player.points = 12500;
      engineStateRef.current = fight;
      setGameState(GameState.PLAYING); // handled as between rounds
    }
  }, []);

  // Play audio events emitted by the engine
  const dispatchAudioEvents = (events: SoundEvent[], state: FightState) => {
    for (const evt of events) {
      switch (evt) {
        case 'SWING':
          soundEngine.playSwing();
          soundEngine.playGrunt(true);
          break;
        case 'HIT_HEAD':
          soundEngine.playHit('HEAD');
          soundEngine.playGrunt(false);
          soundEngine.playCrowd('HIGH');
          lastHitTypeRef.current = 'HEAD';
          break;
        case 'HIT_BODY':
          soundEngine.playHit('BODY');
          soundEngine.playCrowd('LOW');
          lastHitTypeRef.current = 'BODY';
          break;
        case 'HIT_BLOCK':
          soundEngine.playHit('BLOCK');
          break;
        case 'DODGE':
          soundEngine.playDodge();
          break;
        case 'COUNTER':
          soundEngine.playHit('HEAD');
          soundEngine.playCrowd('HIGH');
          break;
        case 'STAR_EARNED':
          soundEngine.playStarEarned();
          break;
        case 'STAR_PUNCH':
          soundEngine.playStarPunch();
          break;
        case 'KNOCKDOWN':
          soundEngine.playHit('HEAD');
          soundEngine.playCrowd('HIGH');
          break;
        case 'KO':
        case 'TKO':
          soundEngine.playKO();
          break;
        case 'BELL':
          soundEngine.playBell();
          break;
        case 'COUNT':
          soundEngine.playCount(state.referee.count);
          break;
        case 'GET_UP':
          soundEngine.playFight();
          break;
        case 'EXHAUSTED':
          soundEngine.playExhausted();
          break;
      }
    }
  };

  const resetGame = (nextOpponent: boolean | number | string = false) => {
    soundEngine.init();
    soundEngine.resume();
    soundEngine.stopMenuTheme();

    let nextIndex = opponentIndex;
    if (typeof nextOpponent === 'string') {
      const foundIdx = ROSTER.findIndex((r) => r.id === nextOpponent);
      nextIndex = foundIdx !== -1 ? foundIdx : 0;
      setOpponentIndex(nextIndex);
    } else if (typeof nextOpponent === 'number') {
      nextIndex = nextOpponent % ROSTER.length;
      setOpponentIndex(nextIndex);
    } else if (nextOpponent) {
      nextIndex = (opponentIndex + 1) % ROSTER.length;
      setOpponentIndex(nextIndex);
    } else {
      nextIndex = 0;
      setOpponentIndex(0);
    }

    const opp = ROSTER[nextIndex];
    // Seed using frame counter or initial seed
    const initialSeed = ((engineStateRef.current.seed * 31 + nextIndex + 1) & 0x7fffffff) >>> 0;
    const fight = createFight(opp.id, initialSeed);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'lowhp') {
        fight.opponent.hp = 1;
        fight.opponent.guard = 'LOW';
      }
    }

    engineStateRef.current = fight;

    pendingInputRef.current = {};
    bufferedInputRef.current = {};
    hitStopCounterRef.current = 0;
    isBlockHeldRef.current = false;
    lastHitTypeRef.current = 'NONE';
    accumulatorRef.current = 0;
    lastTimeRef.current = null;

    setGameState(GameState.ENTRANCE);
    soundEngine.playEntrance(opp.id);

    // Check if skip_entrance, test, or debug flag is present in window.location
    const isFast = typeof window !== 'undefined' && (
      window.location.search.includes('skip_entrance') ||
      window.location.search.includes('test') ||
      window.location.search.includes('debug=')
    );

    // Entrance lasts 180 frames (~3.0s), or 1 frame in fast/test mode
    transitionTimerRef.current = isFast ? 1 : 180;
    nextTransitionStateRef.current = GameState.ROUND_START;
  };

  const handlePlayerInput = useCallback((action: PlayerAction) => {
    switch (action) {
      case PlayerAction.BLOCK:
        isBlockHeldRef.current = true;
        pendingInputRef.current.block = true;
        break;
      case PlayerAction.DODGE_LEFT:
        pendingInputRef.current.dodgeLeft = true;
        break;
      case PlayerAction.DODGE_RIGHT:
        pendingInputRef.current.dodgeRight = true;
        break;
      case PlayerAction.DUCK:
        pendingInputRef.current.duck = true;
        break;
      case PlayerAction.PUNCH_LEFT_HEAD:
        pendingInputRef.current.punchLeftHead = true;
        pendingInputRef.current.mash = true;
        break;
      case PlayerAction.PUNCH_RIGHT_HEAD:
        pendingInputRef.current.punchRightHead = true;
        pendingInputRef.current.mash = true;
        pendingInputRef.current.start = true;
        break;
      case PlayerAction.PUNCH_LEFT_BODY:
        pendingInputRef.current.punchLeftBody = true;
        pendingInputRef.current.mash = true;
        break;
      case PlayerAction.PUNCH_RIGHT_BODY:
        pendingInputRef.current.punchRightBody = true;
        pendingInputRef.current.mash = true;
        pendingInputRef.current.start = true;
        break;
      case PlayerAction.STAR_PUNCH:
        pendingInputRef.current.starPunch = true;
        pendingInputRef.current.mash = true;
        pendingInputRef.current.start = true;
        break;
    }
  }, []);

  const releaseBlock = useCallback(() => {
    isBlockHeldRef.current = false;
    pendingInputRef.current.block = false;
  }, []);

  const [, setRenderTrigger] = useState(0);

  // rAF Game Loop Driver
  useEffect(() => {
    let animId: number;

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = Math.min(250, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;
      accumulatorRef.current += delta;
      const MAX_STEPS = 5;
      let stepsTaken = 0;

      // Handle transitions in frame time (at most MAX_STEPS iterations per tick)
      while (accumulatorRef.current >= FRAME_MS && stepsTaken < MAX_STEPS) {
        accumulatorRef.current -= FRAME_MS;
        stepsTaken++;

        // Feedback timer
        if (feedbackTimerRef.current > 0) {
          feedbackTimerRef.current--;
          if (feedbackTimerRef.current === 0) {
            setFeedbackMessage(null);
          }
        }

        // Screen transition timers
        if (transitionTimerRef.current > 0) {
          transitionTimerRef.current--;
          if (transitionTimerRef.current === 0 && nextTransitionStateRef.current !== null) {
            const nextState = nextTransitionStateRef.current;
            nextTransitionStateRef.current = null;
            setGameState(nextState);

            const isFast = typeof window !== 'undefined' && (
              window.location.search.includes('skip_entrance') ||
              window.location.search.includes('test')
            );

            if (nextState === GameState.ROUND_START) {
              // Sequence: "ROUND n" -> "READY?" -> "FIGHT!" (canvas message bar)
              const stage = roundStartStageRef.current;
              if (stage === 0) {
                const round = engineStateRef.current.round;
                engineStateRef.current = { ...engineStateRef.current, feedbackMessage: `ROUND ${round}` };
                feedbackTimerRef.current = isFast ? 5 : 120;
                soundEngine.playReady();
                transitionTimerRef.current = isFast ? 5 : 60;
                nextTransitionStateRef.current = GameState.ROUND_START;
                roundStartStageRef.current = 1;
              } else if (stage === 1) {
                engineStateRef.current = { ...engineStateRef.current, feedbackMessage: 'READY?' };
                feedbackTimerRef.current = isFast ? 5 : 60;
                transitionTimerRef.current = isFast ? 5 : 60;
                nextTransitionStateRef.current = GameState.ROUND_START;
                roundStartStageRef.current = 2;
              } else {
                engineStateRef.current = { ...engineStateRef.current, feedbackMessage: 'FIGHT!' };
                feedbackTimerRef.current = isFast ? 5 : 60;
                transitionTimerRef.current = isFast ? 5 : 60;
                nextTransitionStateRef.current = GameState.PLAYING;
                roundStartStageRef.current = 0;
              }
            } else if (nextState === GameState.PLAYING) {
              engineStateRef.current = { ...engineStateRef.current, feedbackMessage: 'FIGHT!' };
              feedbackTimerRef.current = 60;
              soundEngine.playFight();
              soundEngine.playFightTheme();
            }
          }
        }

        // If in PLAYING state, step engine
        if (gameState === GameState.PLAYING) {
          if (hitStopCounterRef.current > 0) {
            hitStopCounterRef.current--;
            // Still in hit-stop freeze: buffer any incoming inputs, do not call step()
            bufferedInputRef.current = bufferInput(bufferedInputRef.current, {
              ...pendingInputRef.current,
              block: isBlockHeldRef.current || pendingInputRef.current.block,
            });
            pendingInputRef.current = {
              block: isBlockHeldRef.current,
            };
          } else {
            const input: InputFrame = {
              ...bufferedInputRef.current,
              ...pendingInputRef.current,
              block: isBlockHeldRef.current || bufferedInputRef.current.block || pendingInputRef.current.block,
            };

            // Reset buffers after consuming
            bufferedInputRef.current = {};
            pendingInputRef.current = {
              block: isBlockHeldRef.current,
            };

            const prevState = engineStateRef.current;
            const nextState = step(prevState, input);
            engineStateRef.current = nextState;

            // Stop fight theme on knockdown, round end (BETWEEN_ROUNDS), or match over
            if (
              nextState.phase === 'KNOCKDOWN_COUNT' ||
              nextState.phase === 'BETWEEN_ROUNDS' ||
              nextState.phase === 'MATCH_OVER'
            ) {
              soundEngine.stopMusic();
            }

            // Hit-stop freeze on landed blows / knockdowns (0 in fast/test mode, unless hitstop=1 is specified)
            const allowHitStop = typeof window !== 'undefined' && window.location.search.includes('hitstop=1');
            const isFast = typeof window !== 'undefined' && !allowHitStop && (
              window.location.search.includes('skip_entrance') ||
              window.location.search.includes('test') ||
              window.location.search.includes('debug=')
            );

            if (!isFast && nextState.events.length > 0) {
              const freeze = hitStopFrames(nextState.events);
              if (freeze > 0) {
                hitStopCounterRef.current = freeze;
              }
            }

            // Process sound and feedback events
            if (nextState.events.length > 0) {
              dispatchAudioEvents(nextState.events, nextState);
            }

            if (nextState.feedbackMessage) {
              setFeedbackMessage(nextState.feedbackMessage);
              feedbackTimerRef.current = 60;
            }

            // Check match conclusion
            if (nextState.phase === 'MATCH_OVER' && prevState.phase !== 'MATCH_OVER') {
              soundEngine.stopMusic();
              if (nextState.winner === 'PLAYER') {
                transitionTimerRef.current = 60;
                nextTransitionStateRef.current = GameState.VICTORY;
                soundEngine.playVictoryJingle();
              } else {
                transitionTimerRef.current = 60;
                nextTransitionStateRef.current = GameState.GAME_OVER;
                soundEngine.playDefeatJingle();
              }
            }
          }
        }
      }

      // Leftover accumulator beyond 5 steps is discarded, not carried forward
      if (accumulatorRef.current >= FRAME_MS) {
        accumulatorRef.current = accumulatorRef.current % FRAME_MS;
      }

      setRenderTrigger((v) => v + 1);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  const state = engineStateRef.current;

  // Map engine state into legacy component shapes
  const playerStats: FighterStats = {
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    stamina: (state.player.hearts / state.player.maxHearts) * 100, // hearts visualized as stamina bar
    maxStamina: 100,
    superMeter: state.player.stars,
  };

  const opponentStats: FighterStats = {
    hp: state.opponent.hp,
    maxHp: state.opponent.maxHp,
    stamina: 100,
    maxStamina: 100,
    superMeter: 0,
  };

  const playerState = mapPlayerAction(state.player.action);
  const opponentState = mapOpponentAction(state.opponent.action);

  const getActiveSpecial = (): 'INVERTED' | 'BIG_LIE' | null => {
    if (state.specialState.djTitoInvertedFrames > 0) return 'INVERTED';
    if (state.specialState.magaManBigLieFrames > 0) return 'BIG_LIE';
    return null;
  };

  const advanceRound = useCallback(() => {
    pendingInputRef.current.start = true;
    if (
      engineStateRef.current.phase === 'BETWEEN_ROUNDS' &&
      engineStateRef.current.roundFrame >= ROUNDS.BETWEEN_ROUND_MIN_FRAMES
    ) {
      const next = step(engineStateRef.current, { start: true });
      engineStateRef.current = next;
      setGameState(GameState.PLAYING);
    }
  }, []);

  return {
    gameState,
    setGameState,
    advanceRound,
    playerStats,
    opponentStats,
    playerState,
    opponentState,
    lastHitType: lastHitTypeRef.current,
    feedbackMessage,
    currentOpponent,
    activeSpecial: getActiveSpecial(),
    fightState: state,
    hitStopRemaining: hitStopCounterRef.current,
    handlePlayerInput,
    releaseBlock,
    resetGame,
  };
};
