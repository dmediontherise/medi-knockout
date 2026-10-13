export type ActionType =
  | 'IDLE'
  | 'BLOCK'
  | 'DODGE_LEFT'
  | 'DODGE_RIGHT'
  | 'DUCK'
  | 'PUNCH_LEFT_BODY'
  | 'PUNCH_RIGHT_BODY'
  | 'PUNCH_LEFT_HEAD'
  | 'PUNCH_RIGHT_HEAD'
  | 'STAR_PUNCH'
  | 'HIT'
  | 'KNOCKED_DOWN'
  | 'KO';

export type OpponentActionType =
  | 'IDLE'
  | 'BLOCK_HIGH'
  | 'BLOCK_LOW'
  | 'TELL_JAB_LEFT'
  | 'TELL_JAB_RIGHT'
  | 'TELL_HOOK_LEFT'
  | 'TELL_HOOK_RIGHT'
  | 'TELL_UPPERCUT_LEFT'
  | 'TELL_UPPERCUT_RIGHT'
  | 'PUNCH_JAB_LEFT'
  | 'PUNCH_JAB_RIGHT'
  | 'PUNCH_HOOK_LEFT'
  | 'PUNCH_HOOK_RIGHT'
  | 'PUNCH_UPPERCUT_LEFT'
  | 'PUNCH_UPPERCUT_RIGHT'
  | 'HIT'
  | 'STUNNED'
  | 'KNOCKED_DOWN'
  | 'KO'
  | 'TAUNT';

export type AttackType = 'JAB' | 'HOOK' | 'UPPERCUT';

export interface InputFrame {
  punchLeftBody?: boolean;
  punchRightBody?: boolean;
  punchLeftHead?: boolean;
  punchRightHead?: boolean;
  starPunch?: boolean;
  dodgeLeft?: boolean;
  dodgeRight?: boolean;
  duck?: boolean;
  block?: boolean;
  mash?: boolean;
  start?: boolean;
}

export type SoundEvent =
  | 'SWING'
  | 'HIT_HEAD'
  | 'HIT_BODY'
  | 'HIT_BLOCK'
  | 'DODGE'
  | 'COUNTER'
  | 'STAR_EARNED'
  | 'STAR_PUNCH'
  | 'KNOCKDOWN'
  | 'KO'
  | 'TKO'
  | 'BELL'
  | 'COUNT'
  | 'GET_UP'
  | 'EXHAUSTED'
  | 'SPECIAL_ACTIVATED';

export type BoutPhase =
  | 'ROUND_ACTIVE'
  | 'BETWEEN_ROUNDS'
  | 'KNOCKDOWN_COUNT'
  | 'MATCH_OVER';

export type MatchResult = 'IN_PROGRESS' | 'KO' | 'TKO' | 'DECISION';

export interface RosterOpponentSpec {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  initialHearts: number;
  power: number;
  speed: number;
  baseTells: Record<AttackType, number>;
  combos: string[][];
  specialId: 'bountygate' | 'book_it' | 'run_it_back' | 'pinstripe' | 'big_lie';
}

export interface FightState {
  frame: number;
  seed: number;
  opponentId: string;
  phase: BoutPhase;
  round: number; // 1, 2, 3
  roundFrame: number; // 0..ROUND_FRAMES
  gameClockSeconds: number; // starts at 180 (3:00) down to 0
  result: MatchResult;
  winner: 'PLAYER' | 'OPPONENT' | null;

  player: {
    hp: number;
    maxHp: number;
    hearts: number;
    maxHearts: number;
    stars: number;
    action: ActionType;
    actionFrame: number;
    actionDuration: number;
    isExhausted: boolean;
    knockdownsThisRound: number;
    totalKnockdowns: number;
    points: number;
    hitsLanded: number;
  };

  opponent: {
    hp: number;
    maxHp: number;
    action: OpponentActionType;
    actionFrame: number;
    actionDuration: number;
    guard: 'HIGH' | 'LOW';
    starOpportunity: boolean;
    knockdownsThisRound: number;
    totalKnockdowns: number;
    aiQueue: string[];
    aiWaitFrames: number;
    patternIndex: number;
    lastTellAttack: AttackType | null;
    lastHitSide?: 'LEFT' | 'RIGHT';
    lastHitTarget?: 'HEAD' | 'BODY';
  };

  specialState: {
    djTitoInvertedFrames: number;
    magaManBigLieFrames: number;
    mediJinxBookItCharges: number;
    mrYankeePinstripeCharges: number;
  };

  referee: {
    count: number;
    countFrameCounter: number;
    downFighter: 'PLAYER' | 'OPPONENT' | null;
    targetGetUpCount: number;
    playerMashCount: number;
  };

  events: SoundEvent[];
  feedbackMessage: string | null;
}
