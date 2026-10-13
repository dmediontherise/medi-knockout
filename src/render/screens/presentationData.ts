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
  },
  medi_jinx: {
    id: 'medi_jinx',
    name: 'MEDI JINX',
    record: '15-6',
    hometown: 'BROOKLYN, NY',
    quote: '"BOOK IT! YOU CANNOT WIN!"',
    coachTip: 'WHEN HE CALLS BOOK IT, HIS UPPERCUT IS BLINDINGLY FAST! DUCK IT!',
    sprite: IDLE_BASE_MEDI_JINX,
  },
  dj_tito: {
    id: 'dj_tito',
    name: 'DJ TITO',
    record: '22-2',
    hometown: 'MIAMI, FL',
    quote: '"RUN IT BACK! FEEL THE BEAT!"',
    coachTip: 'RUN IT BACK FLIPS YOUR CONTROLS! PUSH THE OPPOSITE WAY TO DODGE!',
    sprite: IDLE_BASE_DJ_TITO,
  },
  mr_yankee: {
    id: 'mr_yankee',
    name: 'MR. YANKEE',
    record: '27-1',
    hometown: 'BRONX, NY',
    quote: '"PINSTRIPES NEVER LOSE!"',
    coachTip: 'PINSTRIPE SPECIAL LANDS 5 RAPID HITS! DODGE REPEATEDLY TO PUNISH HIM!',
    sprite: IDLE_BASE_MR_YANKEE,
  },
  maga_man: {
    id: 'maga_man',
    name: 'MAGA MAN',
    record: '30-0',
    hometown: 'PALM BEACH, FL',
    quote: '"STOP THE COUNT! BIG LIE!"',
    coachTip: 'DURING BIG LIE, YOUR PUNCHES HURT YOURSELF! WAIT FOR IT TO EXPIRE!',
    sprite: IDLE_BASE_MAGA_MAN,
  },
};

export const CIRCUIT_ROSTER_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

function isOpaqueChar(ch: string | undefined): boolean {
  return !!ch && ch !== '.' && ch !== ' ';
}

// Build a square portrait crop that shows the character's head:
// the top of the crop is the sprite's first opaque row, horizontally centred
// on the opaque pixels of the sprite's first 24 rows.
export function computePortraitCrop(
  sprite: SpriteData,
  size: number
): { x: number; y: number; w: number; h: number } {
  let firstOpaque = -1;
  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.rows[y];
    if (row && row.split('').some((c) => c !== '.' && c !== ' ')) {
      firstOpaque = y;
      break;
    }
  }
  if (firstOpaque < 0) firstOpaque = 0;

  let minX = sprite.width;
  let maxX = -1;
  const scanRows = Math.min(sprite.height, 24);
  for (let y = 0; y < scanRows; y++) {
    const row = sprite.rows[y];
    if (!row) continue;
    for (let x = 0; x < sprite.width; x++) {
      const c = row[x];
      if (c && c !== '.' && c !== ' ') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < 0) {
    minX = 0;
    maxX = sprite.width - 1;
  }

  const centerX = Math.floor((minX + maxX) / 2);
  let cropX = centerX - Math.floor(size / 2);
  if (cropX < 0) cropX = 0;
  if (cropX + size > sprite.width) cropX = Math.max(0, sprite.width - size);

  let cropY = firstOpaque;
  if (cropY + size > sprite.height) cropY = Math.max(0, sprite.height - size);

  return { x: cropX, y: cropY, w: size, h: size };
}

// Compute the head portrait crop for an opponent at a given square size.
export function getPortraitCrop(
  oppId: string,
  size: number
): { x: number; y: number; w: number; h: number } {
  const info = OPPONENT_PRESENTATION[oppId];
  if (!info) return { x: 0, y: 0, w: size, h: size };
  return computePortraitCrop(info.sprite, size);
}

// Wrap text into lines of at most maxChars characters (word boundaries).
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let curLine = '';
  for (const w of words) {
    if ((curLine + (curLine ? ' ' : '') + w).length <= maxChars) {
      curLine = curLine + (curLine ? ' ' : '') + w;
    } else {
      if (curLine) lines.push(curLine);
      curLine = w;
    }
  }
  if (curLine) lines.push(curLine);
  return lines;
}
