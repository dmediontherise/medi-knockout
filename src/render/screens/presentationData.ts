import { ROSTER_SPECS } from '../../core/constants';
import { IDLE_BASE_AINT_MAN } from '../sprites/generated/aint_man';
import { IDLE_BASE_MEDI_JINX } from '../sprites/generated/medi_jinx';
import { IDLE_BASE_DJ_TITO } from '../sprites/generated/dj_tito';
import { IDLE_BASE_MR_YANKEE } from '../sprites/generated/mr_yankee';
import { IDLE_BASE_MAGA_MAN } from '../sprites/generated/maga_man';
import { SpriteData } from '../types';

export interface OpponentPresentationInfo {
  id: string;
  name: string;
  record: string;
  hometown: string;
  quote: string;
  coachTip: string;
  sprite: SpriteData;
  portraitCrop: { x: number; y: number; w: number; h: number };
}

export const OPPONENT_PRESENTATION: Record<string, OpponentPresentationInfo> = {
  aint_man: {
    id: 'aint_man',
    name: 'AINT MAN',
    record: '18-4',
    hometown: 'NEW ORLEANS, LA',
    quote: '"BOUNTY ON YOUR HEAD!"',
    coachTip: 'WATCH FOR HIS BOUNTYGATE 3-HIT COMBO! DUCK THE JAB, DODGE THE HOOK!',
    sprite: IDLE_BASE_AINT_MAN,
    portraitCrop: { x: 25, y: 15, w: 55, h: 55 },
  },
  medi_jinx: {
    id: 'medi_jinx',
    name: 'MEDI JINX',
    record: '15-6',
    hometown: 'BROOKLYN, NY',
    quote: '"BOOK IT! YOU CANNOT WIN!"',
    coachTip: 'WHEN HE CALLS BOOK IT, HIS UPPERCUT IS BLINDINGLY FAST! DUCK IT!',
    sprite: IDLE_BASE_MEDI_JINX,
    portraitCrop: { x: 25, y: 15, w: 55, h: 55 },
  },
  dj_tito: {
    id: 'dj_tito',
    name: 'DJ TITO',
    record: '22-2',
    hometown: 'MIAMI, FL',
    quote: '"RUN IT BACK! FEEL THE BEAT!"',
    coachTip: 'RUN IT BACK FLIPS YOUR CONTROLS! PUSH THE OPPOSITE WAY TO DODGE!',
    sprite: IDLE_BASE_DJ_TITO,
    portraitCrop: { x: 25, y: 15, w: 55, h: 55 },
  },
  mr_yankee: {
    id: 'mr_yankee',
    name: 'MR. YANKEE',
    record: '27-1',
    hometown: 'BRONX, NY',
    quote: '"PINSTRIPES NEVER LOSE!"',
    coachTip: 'PINSTRIPE SPECIAL LANDS 5 RAPID HITS! DODGE REPEATEDLY TO PUNISH HIM!',
    sprite: IDLE_BASE_MR_YANKEE,
    portraitCrop: { x: 25, y: 15, w: 55, h: 55 },
  },
  maga_man: {
    id: 'maga_man',
    name: 'MAGA MAN',
    record: '30-0',
    hometown: 'PALM BEACH, FL',
    quote: '"STOP THE COUNT! BIG LIE!"',
    coachTip: 'DURING BIG LIE, YOUR PUNCHES HURT YOURSELF! WAIT FOR IT TO EXPIRE!',
    sprite: IDLE_BASE_MAGA_MAN,
    portraitCrop: { x: 25, y: 15, w: 55, h: 55 },
  },
};

export const CIRCUIT_ROSTER_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];
