import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, PlayerAction, OpponentAction, FighterStats, HitType } from '../types';
import { ROSTER } from '../constants';
import { soundEngine } from '../utils/sound';
import { createFight, step } from '../src/core/engine';
import { FightState, InputFrame, SoundEvent } from '../src/core/types';

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
  const isBlockHeldRef = useRef(false);

  // Transition timer (in integer frames)
  const transitionTimerRef = useRef<number>(0);
  const nextTransitionStateRef = useRef<GameState | null>(null);

  // Visual/Feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number>(0);
  const lastHitTypeRef = useRef<HitType>('NONE');

  // Time accumulator for fixed 1/60 s timestep
  const accumulatorRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

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
    engineStateRef.current = createFight(opp.id, initialSeed);

    pendingInputRef.current = {};
    isBlockHeldRef.current = false;
    lastHitTypeRef.current = 'NONE';
    accumulatorRef.current = 0;
    lastTimeRef.current = null;

    setGameState(GameState.ENTRANCE);
    soundEngine.playEntrance(opp.id);

    // Entrance lasts 240 frames (~4.0s)
    transitionTimerRef.current = 240;
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
        break;
      case PlayerAction.PUNCH_LEFT_BODY:
        pendingInputRef.current.punchLeftBody = true;
        pendingInputRef.current.mash = true;
        break;
      case PlayerAction.PUNCH_RIGHT_BODY:
        pendingInputRef.current.punchRightBody = true;
        pendingInputRef.current.mash = true;
        break;
      case PlayerAction.STAR_PUNCH:
        pendingInputRef.current.starPunch = true;
        pendingInputRef.current.mash = true;
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

            if (nextState === GameState.ROUND_START) {
              setFeedbackMessage('READY?');
              feedbackTimerRef.current = 120;
              soundEngine.playReady();
              transitionTimerRef.current = 120; // 2 seconds
              nextTransitionStateRef.current = GameState.PLAYING;
            } else if (nextState === GameState.PLAYING) {
              setFeedbackMessage('FIGHT!');
              feedbackTimerRef.current = 60;
              soundEngine.playFight();
            }
          }
        }

        // If in PLAYING state, step engine
        if (gameState === GameState.PLAYING) {
          const input: InputFrame = {
            ...pendingInputRef.current,
            block: isBlockHeldRef.current || pendingInputRef.current.block,
          };

          // Reset one-shot inputs after consuming
          pendingInputRef.current = {
            block: isBlockHeldRef.current,
          };

          const prevState = engineStateRef.current;
          const nextState = step(prevState, input);
          engineStateRef.current = nextState;

          // Process sound and feedback events
          if (nextState.events.length > 0) {
            dispatchAudioEvents(nextState.events, nextState);
          }

          if (nextState.feedbackMessage) {
            setFeedbackMessage(nextState.feedbackMessage);
            feedbackTimerRef.current = 60;
          }

          // Check match conclusion
          if (nextState.phase === 'MATCH_OVER') {
            if (nextState.winner === 'PLAYER') {
              transitionTimerRef.current = 60;
              nextTransitionStateRef.current = GameState.VICTORY;
            } else {
              transitionTimerRef.current = 60;
              nextTransitionStateRef.current = GameState.GAME_OVER;
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

  return {
    gameState,
    playerStats,
    opponentStats,
    playerState,
    opponentState,
    lastHitType: lastHitTypeRef.current,
    feedbackMessage,
    currentOpponent,
    activeSpecial: getActiveSpecial(),
    fightState: state,
    handlePlayerInput,
    releaseBlock,
    resetGame,
  };
};
