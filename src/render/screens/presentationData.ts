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

export const PORTRAIT_VERTICAL_OFFSETS: Record<string, number> = {
  medi_jinx: 25,
};

// Build a square portrait crop that shows the character's head and shoulders:
// - starts at the idle frame's first opaque row (+ optional verticalOffset)
// - is at least 40% of the idle frame's opaque height (using 45% to capture head & shoulders)
// - is horizontally centered on the head center (top 25% opaque rows center)
export function computePortraitCrop(
  sprite: SpriteData,
  _size?: number,
  verticalOffset: number = 0
): { x: number; y: number; w: number; h: number } {
  let firstOpaque = -1;
  let lastOpaque = -1;
  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.rows[y];
    if (row && row.split('').some((c) => c !== '.' && c !== ' ')) {
      if (firstOpaque < 0) firstOpaque = y;
      lastOpaque = y;
    }
  }
  if (firstOpaque < 0) firstOpaque = 0;
  if (lastOpaque < 0) lastOpaque = sprite.height - 1;

  const opaqueHeight = lastOpaque - firstOpaque + 1;

  // Head center: opaque pixels in the top 25% of rows
  const topRowCount = Math.max(1, Math.floor(sprite.height * 0.25));
  let sumX = 0;
  let count = 0;
  for (let r = 0; r < topRowCount; r++) {
    const row = sprite.rows[r];
    if (!row) continue;
    for (let c = 0; c < sprite.width; c++) {
      const ch = row[c];
      if (ch && ch !== '.' && ch !== ' ') {
        sumX += c;
        count++;
      }
    }
  }
  const headCenterX = count > 0 ? Math.round(sumX / count) : Math.floor(sprite.width / 2);

  // Crop at least 40% of opaque height (45% for full head and shoulders), square aspect ratio
  const cropH = Math.round(0.45 * opaqueHeight);
  const cropW = cropH;

  let cropX = Math.round(headCenterX - cropW / 2);
  let cropY = firstOpaque + verticalOffset;

  if (cropX < 0) cropX = 0;
  if (cropX + cropW > sprite.width) cropX = Math.max(0, sprite.width - cropW);
  if (cropY < 0) cropY = 0;
  if (cropY + cropH > sprite.height) cropY = Math.max(0, sprite.height - cropH);

  return { x: cropX, y: cropY, w: cropW, h: cropH };
}

// Compute the head portrait crop for an opponent.
export function getPortraitCrop(
  oppId: string,
  size?: number
): { x: number; y: number; w: number; h: number } {
  const info = OPPONENT_PRESENTATION[oppId];
  if (!info) return { x: 0, y: 0, w: size || 32, h: size || 32 };
  const offset = PORTRAIT_VERTICAL_OFFSETS[oppId] ?? 0;
  return computePortraitCrop(info.sprite, size, offset);
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
