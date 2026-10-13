import { ActionType, OpponentActionType } from '../core/types';
import { SpriteData } from './sprites/types';
import { AINT_MAN_SPRITES } from './sprites/aintMan';
import { MEDI_JINX_SPRITES } from './sprites/mediJinx';
import { DJ_TITO_SPRITES } from './sprites/djTito';
import { MR_YANKEE_SPRITES } from './sprites/mrYankee';
import { MAGA_MAN_SPRITES } from './sprites/magaMan';
import { getPlayerSprite } from './sprites/player';

export const OPPONENT_SPRITE_MAPS: Record<string, Record<string, SpriteData>> = {
  aint_man: AINT_MAN_SPRITES,
  medi_jinx: MEDI_JINX_SPRITES,
  dj_tito: DJ_TITO_SPRITES,
  mr_yankee: MR_YANKEE_SPRITES,
  maga_man: MAGA_MAN_SPRITES,
};

export function getOpponentSprite(
  opponentId: string,
  action: OpponentActionType | string,
  frame: number = 0
): SpriteData {
  const spriteMap = OPPONENT_SPRITE_MAPS[opponentId] || OPPONENT_SPRITE_MAPS['aint_man'];

  if (action === 'IDLE') {
    // 2-frame breathing idle animation alternating every 30 frames (0.5s at 60fps)
    const isFrame2 = Math.floor(frame / 30) % 2 === 1;
    return (isFrame2 && spriteMap['IDLE_2']) ? spriteMap['IDLE_2'] : spriteMap['IDLE_1'];
  }

  const sprite = spriteMap[action];
  if (sprite) {
    return sprite;
  }

  // Fallback
  return spriteMap['IDLE_1'];
}

export function resolvePlayerSprite(
  action: ActionType | string,
  isExhausted: boolean = false
): SpriteData {
  return getPlayerSprite(action, isExhausted);
}
