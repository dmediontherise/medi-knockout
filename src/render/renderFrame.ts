import { FightState, AttackType } from '../core/types';
import { OPPONENT_ATTACKS } from '../core/constants';
import { nesToRgba } from './nesPalette';
import { drawRingBackground } from './sprites/ring';
import { drawBitmapText, drawBitmapText2x } from './sprites/font';
import { getOpponentSprite, resolvePlayerSprite, resolvePlayerFrame, OPPONENT_POSES, PLAYER_POSES, getSpriteAnchor } from './poses';
import { REFEREE_SPRITES, getLargeCountDigitSprite } from './sprites/referee';
import { SpriteData } from './sprites/types';
import { SPARK_SPRITE, STAR_SPRITE } from './sprites/effects';

export const CANVAS_WIDTH = 256;
export const CANVAS_HEIGHT = 240;

// Knockdown count digit draw position (top-left of the 14x20 digit sprite)
export const COUNT_DIGIT_X = 122;
export const COUNT_DIGIT_Y = 60;

// When the opponent is down for the count the player steps aside (to the right) so the
// fallen opponent is not hidden behind him, the way the NES game clears the view.
export const PLAYER_STEP_ASIDE_SHIFT = 64;
export const PLAYER_STEP_ASIDE_MIN_X = 152;

export function isPlayerSteppingAside(state: FightState): boolean {
  return state.phase === 'KNOCKDOWN_COUNT' && state.referee.downFighter === 'OPPONENT';
}

// Compute the player draw position (and sprite) for a state. During the opponent's
// count the player keeps his idle pose and is shifted to the right so his
// leftmost pixel is at x >= PLAYER_STEP_ASIDE_MIN_X.
export function computePlayerDraw(state: FightState): { x: number; y: number; sprite: SpriteData } {
  const aside = isPlayerSteppingAside(state);
  const action = aside ? 'IDLE' : state.player.action;
  const actionFrame = aside ? 0 : (state.player.actionFrame || 0);
  const transform = PLAYER_POSES[action] || PLAYER_POSES['IDLE'];

  const resolved = resolvePlayerFrame(action, actionFrame, state);
  const sprite = resolved.sprite;
  const anchorX = resolved.anchorX;

  let shakeX = 0;
  if (transform.shake > 0) {
    const sign = (Math.floor(actionFrame / 2) % 2 === 0) ? 1 : -1;
    shakeX = sign * transform.shake;
  }

  // Standing frames drawn with frame's bottom row at canvas y = 239,
  // and anchorX at canvas x = 128 (DOWN and FALL included).
  const baseX = 128 - anchorX + shakeX;
  const y = 239 - (sprite.height - 1);

  // When stepping aside, leftmost pixel must be at x >= PLAYER_STEP_ASIDE_MIN_X
  // Find leftmost opaque pixel relative to sprite origin
  let spriteMinOpaqueX = 0;
  for (const row of sprite.rows) {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '.' && row[c] !== ' ') {
        if (c < spriteMinOpaqueX || spriteMinOpaqueX === 0) {
          spriteMinOpaqueX = c;
        }
        break;
      }
    }
  }

  let x = baseX;
  if (aside) {
    // We want x + spriteMinOpaqueX >= PLAYER_STEP_ASIDE_MIN_X
    const asideShiftedX = baseX + PLAYER_STEP_ASIDE_SHIFT;
    const minRequiredX = PLAYER_STEP_ASIDE_MIN_X - spriteMinOpaqueX;
    x = Math.max(asideShiftedX, minRequiredX);
  }

  return { x, y, sprite };
}

// Helper to blit a SpriteData into the canvas ImageData
function blitSprite(
  data: Uint8ClampedArray,
  sprite: SpriteData,
  destX: number,
  destY: number,
  overrideColor?: number,
  rowOffsets?: number[]
) {
  for (let sy = 0; sy < sprite.height; sy++) {
    const py = destY + sy;
    if (py < 0 || py >= CANVAS_HEIGHT) continue;
    const row = sprite.rows[sy];
    if (!row) continue;

    const rowOffset = rowOffsets ? (rowOffsets[sy] ?? 0) : 0;

    for (let sx = 0; sx < sprite.width; sx++) {
      const px = destX + sx + rowOffset;
      if (px < 0 || px >= CANVAS_WIDTH) continue;

      const char = row[sx];
      if (char === '.' || char === ' ') continue;

      const nesColor = (overrideColor !== undefined) ? overrideColor : (sprite.palette[char] ?? -1);
      if (nesColor < 0) continue;

      const [r, g, b] = nesToRgba(nesColor);
      const idx = (py * CANVAS_WIDTH + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}

// Render HUD across top (y < 48)
function renderHud(
  data: Uint8ClampedArray,
  state: FightState,
  flash: boolean
) {
  const setHudPixel = (x: number, y: number, nesColor: number) => {
    if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
      const [r, g, b] = nesToRgba(nesColor);
      const idx = (y * CANVAS_WIDTH + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  };

  // Top line 1: Points & Round Clock
  const pointsStr = state.player.points.toString().padStart(6, '0');
  const clockSecs = Math.max(0, state.gameClockSeconds);
  const mins = Math.floor(clockSecs / 60);
  const secs = (clockSecs % 60).toString().padStart(2, '0');
  const clockStr = `R${state.round} ${mins}:${secs}`;

  drawBitmapText(setHudPixel, pointsStr, 8, 4, 0x20);
  drawBitmapText(setHudPixel, clockStr, 176, 4, 0x20);

  // Line 2: Opponent Name / Opponent Stamina Bar (y: 16)
  drawBitmapText(setHudPixel, "OPPONENT", 8, 16, 0x28); // Gold text

  // Opponent HP bar (y: 16, x: 80..160)
  const oppHpRatio = Math.max(0, Math.min(1, state.opponent.hp / state.opponent.maxHp));
  const oppBarWidth = 64;
  const oppFilledWidth = Math.floor(oppBarWidth * oppHpRatio);

  for (let by = 16; by < 23; by++) {
    for (let bx = 80; bx < 80 + oppBarWidth; bx++) {
      if (by === 16 || by === 22 || bx === 80 || bx === 80 + oppBarWidth - 1) {
        setHudPixel(bx, by, 0x20); // White border
      } else if (bx - 81 < oppFilledWidth) {
        setHudPixel(bx, by, (oppHpRatio < 0.25 && flash) ? 0x20 : 0x16); // Red fill / flash white
      } else {
        setHudPixel(bx, by, 0x0F); // Empty black
      }
    }
  }

  // Line 3: Player Hearts, Stars, Player Stamina Bar (y: 28)
  const heartStr = `\x03${state.player.hearts.toString().padStart(2, '0')}`;
  const starStr = `\x04${state.player.stars}`;
  drawBitmapText(setHudPixel, heartStr, 8, 28, 0x16); // Red heart
  drawBitmapText(setHudPixel, starStr, 40, 28, 0x28); // Gold star

  drawBitmapText(setHudPixel, "PLAYER", 80, 28, 0x20); // White text

  // Player HP bar (y: 28, x: 136..200)
  const playerHpRatio = Math.max(0, Math.min(1, state.player.hp / state.player.maxHp));
  const playerBarWidth = 64;
  const playerFilledWidth = Math.floor(playerBarWidth * playerHpRatio);

  for (let by = 28; by < 35; by++) {
    for (let bx = 136; bx < 136 + playerBarWidth; bx++) {
      if (by === 28 || by === 34 || bx === 136 || bx === 136 + playerBarWidth - 1) {
        setHudPixel(bx, by, 0x20); // White border
      } else if (bx - 137 < playerFilledWidth) {
        setHudPixel(bx, by, (playerHpRatio < 0.25 && flash) ? 0x20 : 0x28); // Gold/yellow player stamina
      } else {
        setHudPixel(bx, by, 0x0F);
      }
    }
  }

  // Subtle dividing line under HUD at y = 47
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    setHudPixel(x, 47, 0x0F);
  }
}

export function computeScreenShake(state: FightState): { shakeX: number; shakeY: number } {
  let shakeX = 0;
  let shakeY = 0;

  if (state.player.action === 'HIT' && (state.player.actionFrame || 0) < 8) {
    shakeX = Math.floor((state.player.actionFrame || 0) / 2) % 2 === 0 ? 2 : -2;
  }

  const oppDown = state.opponent.action === 'KNOCKED_DOWN' || state.opponent.action === 'KO';
  const playerDown = state.player.action === 'KNOCKED_DOWN' || state.player.action === 'KO';
  const oppAf = state.opponent.actionFrame || 0;
  const playerAf = state.player.actionFrame || 0;

  if (oppDown && oppAf >= 10 && oppAf <= 21) {
    shakeY = Math.floor((oppAf - 10) / 2) % 2 === 0 ? 3 : -3;
  } else if (playerDown && playerAf >= 12 && playerAf <= 23) {
    shakeY = Math.floor((playerAf - 12) / 2) % 2 === 0 ? 3 : -3;
  }

  return { shakeX, shakeY };
}

export function computeOpponentLunge(
  action: string,
  actionFrame: number
): { lungeDx: number; lungeDy: number } {
  if (!action.startsWith('PUNCH_')) {
    return { lungeDx: 0, lungeDy: 0 };
  }

  let attackType: AttackType = 'JAB';
  if (action.includes('HOOK')) {
    attackType = 'HOOK';
  } else if (action.includes('UPPERCUT')) {
    attackType = 'UPPERCUT';
  }

  const config = OPPONENT_ATTACKS[attackType];
  const activeFrames = config.activeFrames;
  const recoveryFrames = config.recoveryFrames;
  const totalFrames = activeFrames + recoveryFrames;

  const isHookLeft = action === 'PUNCH_HOOK_LEFT';
  const isHookRight = action === 'PUNCH_HOOK_RIGHT';
  const baseDx = isHookLeft ? 10 : (isHookRight ? -10 : 0);
  const baseDy = 8;

  if (actionFrame <= activeFrames) {
    return { lungeDx: baseDx, lungeDy: baseDy };
  } else if (actionFrame <= totalFrames) {
    const progress = (actionFrame - activeFrames) / recoveryFrames;
    const factor = Math.max(0, 1 - progress);
    const lungeDx = Math.round(baseDx * factor);
    const lungeDy = Math.round(baseDy * factor);
    return {
      lungeDx: lungeDx === 0 ? 0 : lungeDx,
      lungeDy: lungeDy === 0 ? 0 : lungeDy,
    };
  } else {
    return { lungeDx: 0, lungeDy: 0 };
  }
}

export function computeOpponentDraw(
  opponentId: string,
  action: string,
  actionFrame: number = 0,
  frame: number = 0,
  hitSide: 'LEFT' | 'RIGHT' = 'RIGHT',
  hitTarget: 'HEAD' | 'BODY' = 'HEAD'
): { x: number; y: number; sprite: SpriteData; isHidden: boolean; effect: string; rowOffsets?: number[] } {
  const oppTransform = OPPONENT_POSES[action] || OPPONENT_POSES['IDLE'];
  const oppSprite = getOpponentSprite(opponentId, action, actionFrame, hitSide, hitTarget);
  const anchor = getSpriteAnchor(oppSprite);

  const isDown = action === 'KNOCKED_DOWN' || action === 'KO';

  // KO blink: from actionFrame 31, KO blinks: hidden on 4-frame windows, every other window
  let isKoHidden = false;
  if (action === 'KO' && actionFrame >= 31) {
    const blinkWindow = Math.floor((actionFrame - 31) / 4);
    if (blinkWindow % 2 === 1) {
      isKoHidden = true;
    }
  }

  // Taunt bounce: oscillate dy between 0 and -6 over a 16-frame period of actionFrame
  let tauntBounceDy = 0;
  if (action === 'TAUNT') {
    const phase = actionFrame % 16;
    if (phase < 8) {
      tauntBounceDy = -Math.round((phase / 7) * 6);
    } else {
      tauntBounceDy = -Math.round(((15 - phase) / 7) * 6);
    }
  }

  // Breathing offset: 1px vertical breathing on frame 30 window (global frame counter per R1)
  const isBreathingFrame = Math.floor(frame / 30) % 2 === 1;
  const breathingDy = (action === 'IDLE' && isBreathingFrame) ? 1 : 0;

  // Directional hit reaction displacement
  let hitDx = 0;
  let hitDy = 0;
  let effect = oppTransform.effect;

  if (action === 'HIT') {
    if (hitTarget === 'BODY') {
      effect = 'spark-body';
      if (actionFrame <= 5) {
        hitDy = 3;
      } else if (actionFrame <= 10) {
        hitDy = Math.round(3 * (1 - (actionFrame - 5) / 5));
      } else {
        hitDy = 0;
      }
    } else {
      effect = 'spark-head';
      const dir = hitSide === 'LEFT' ? 1 : -1;
      if (actionFrame <= 5) {
        hitDx = dir * 6;
      } else if (actionFrame <= 10) {
        hitDx = Math.round(dir * 6 * (1 - (actionFrame - 5) / 5));
      } else {
        hitDx = 0;
      }
    }
  }

  // Punch lunge offset
  const { lungeDx, lungeDy } = computeOpponentLunge(action, actionFrame);

  let x: number;
  let y: number;

  if (isDown) {
    if (actionFrame < 10) {
      // frames 0-9: HIT frame moved up and back (dy -4)
      x = Math.round(128 - anchor.headCenterX) + hitDx;
      y = 190 - oppSprite.height + 1 - 4;
    } else {
      // frames 10+: lying frame with bottom row at y = 192 and center opaque x at 128 ± 4.
      // Drops in from y-offset -12 over frames 10-15, with a 2 px bounce on frames 16-19, then rests.
      let dropOffset = 0;
      if (actionFrame >= 10 && actionFrame <= 15) {
        dropOffset = Math.round(-12 * (1 - (actionFrame - 10) / 5));
      } else if (actionFrame >= 16 && actionFrame <= 19) {
        dropOffset = -2;
      } else {
        dropOffset = 0;
      }

      x = Math.round(128 - anchor.centerOpaqueX);
      y = 192 - anchor.lastRow + dropOffset;
    }
  } else {
    // Standing frames
    if (action === 'HIT') {
      x = Math.round(128 - anchor.headCenterX) + hitDx;
      y = 190 - oppSprite.height + 1 + hitDy;
    } else if (action.startsWith('PUNCH_')) {
      x = Math.round(128 - anchor.headCenterX) + lungeDx;
      y = 190 - oppSprite.height + 1 + lungeDy + breathingDy + tauntBounceDy;
    } else {
      const baseOppDy = action === 'TAUNT' ? 0 : oppTransform.dy;
      const localShakeX = (action === 'STUNNED' && oppTransform.shake > 0)
        ? ((Math.floor(actionFrame / 4) % 2 === 0 ? 1 : -1) * oppTransform.shake)
        : 0;
      x = Math.round(128 - anchor.headCenterX) + oppTransform.dx + localShakeX;
      y = 190 - oppSprite.height + 1 + baseOppDy + breathingDy + tauntBounceDy;
    }
  }

  // Visible head snap: on head hit, actionFrame 0-7 (eases to 0 by 10), shear head rows in top 30% of opaque height
  let rowOffsets: number[] | undefined;
  if (action === 'HIT' && hitTarget !== 'BODY' && actionFrame <= 10) {
    const timeFactor = actionFrame <= 7 ? 1.0 : Math.max(0, (10 - actionFrame) / 3);
    if (timeFactor > 0) {
      const dir = hitSide === 'LEFT' ? 1 : -1;
      let firstOpaque = -1;
      let lastOpaque = -1;
      for (let r = 0; r < oppSprite.height; r++) {
        const row = oppSprite.rows[r];
        if (row && row.split('').some((c) => c !== '.' && c !== ' ')) {
          if (firstOpaque < 0) firstOpaque = r;
          lastOpaque = r;
        }
      }
      if (firstOpaque >= 0) {
        const opaqueH = lastOpaque - firstOpaque + 1;
        const top30Rows = 0.30 * opaqueH;
        rowOffsets = [];
        for (let r = 0; r < oppSprite.height; r++) {
          if (r >= firstOpaque && r <= firstOpaque + top30Rows) {
            const rowFrac = (r - firstOpaque) / top30Rows;
            const falloff = 1 - rowFrac;
            rowOffsets.push(Math.round(6 * dir * timeFactor * falloff));
          } else {
            rowOffsets.push(0);
          }
        }
      }
    }
  }

  return { x, y, sprite: oppSprite, isHidden: isKoHidden, effect, rowOffsets };
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: FightState
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;
  const frame = state.frame;
  const flash = Math.floor(frame / 8) % 2 === 0;

  const { shakeX, shakeY } = computeScreenShake(state);

  // 1. Draw Ring Background & Crowd (with screen shake)
  const setPixel = (x: number, y: number, nesColor: number) => {
    const [r, g, b] = nesToRgba(nesColor);
    const idx = (y * CANVAS_WIDTH + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  drawRingBackground(setPixel, frame, shakeX, shakeY);

  // 2. Draw HUD (y: 0..47) - UNSHAKEN
  renderHud(data, state, flash);

  // 3. Draw Referee (if KNOCKDOWN_COUNT phase or MATCH_OVER)
  const inKnockdown = state.phase === 'KNOCKDOWN_COUNT';
  const isMatchOver = state.phase === 'MATCH_OVER';

  if (inKnockdown || isMatchOver) {
    const refSprite = inKnockdown ? REFEREE_SPRITES.COUNT : REFEREE_SPRITES.STAND;
    blitSprite(data, refSprite, 48 + shakeX, 88 + shakeY);
  }

  // 4. Draw Opponent
  const oppActionFrame = state.opponent.actionFrame || 0;
  const oppDraw = computeOpponentDraw(
    state.opponentId,
    state.opponent.action,
    oppActionFrame,
    frame,
    state.opponent.lastHitSide,
    state.opponent.lastHitTarget
  );

  if (!oppDraw.isHidden) {
    const starFlashActive =
      state.phase === 'ROUND_ACTIVE' &&
      state.opponent.action !== 'KNOCKED_DOWN' &&
      state.opponent.action !== 'KO';
    const oppOverride = (state.opponent.starOpportunity && flash && starFlashActive) ? 0x20 : undefined;

    blitSprite(data, oppDraw.sprite, oppDraw.x + shakeX, oppDraw.y + shakeY, oppOverride, oppDraw.rowOffsets);

    // Opponent Effect Sprites (spark / stars)
    if (oppDraw.effect === 'spark-head') {
      blitSprite(data, SPARK_SPRITE, oppDraw.x + shakeX + Math.floor(oppDraw.sprite.width / 2) - 4, oppDraw.y + shakeY + 16);
    } else if (oppDraw.effect === 'spark-body') {
      blitSprite(data, SPARK_SPRITE, oppDraw.x + shakeX + Math.floor(oppDraw.sprite.width / 2) - 4, oppDraw.y + 50);
    } else if (oppDraw.effect === 'stars') {
      const angle = (oppActionFrame * 0.15) % (Math.PI * 2);
      const starX = oppDraw.x + Math.floor(oppDraw.sprite.width / 2) + Math.round(Math.cos(angle) * 16) - 4;
      const starY = oppDraw.y + Math.round(Math.sin(angle) * 6) - 8;
      blitSprite(data, STAR_SPRITE, starX + shakeX, starY + shakeY);
    }
  }

  // 5. Draw Player
  const playerActionFrame = state.player.actionFrame || 0;
  const playerDraw = computePlayerDraw(state);
  const playerSprite = playerDraw.sprite;
  const playerX = playerDraw.x + shakeX;
  const playerY = playerDraw.y + shakeY;

  blitSprite(data, playerSprite, playerX, playerY);

  // 6. Hit feedback flash
  if (state.player.action === 'HIT' && playerActionFrame <= 3) {
    blitSprite(data, playerSprite, playerX, playerY, 0x20);
  }

  // 7. In-fight canvas feedback messages
  if (state.feedbackMessage) {
    const msg = state.feedbackMessage;
    const charWidth = 16;
    const textWidth = msg.length * charWidth;
    const startX = Math.max(0, Math.round((CANVAS_WIDTH - textWidth) / 2));
    const startY = 56;

    const barPadX = 6;
    const barLeft = Math.max(0, startX - barPadX);
    const barRight = Math.min(CANVAS_WIDTH - 1, startX + textWidth + barPadX);
    const barTop = 52;
    const barBottom = 76;

    for (let by = barTop; by <= barBottom; by++) {
      for (let bx = barLeft; bx <= barRight; bx++) {
        const idx = (by * CANVAS_WIDTH + bx) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }

    const setMsgPixel = (x: number, y: number, nesColor: number) => {
      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
      const [r, g, b] = nesToRgba(nesColor);
      const idx = (y * CANVAS_WIDTH + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    };

    drawBitmapText2x(setMsgPixel, msg, startX, startY, 0x28);
  }

  // 8. Knockdown count digit
  if (state.phase === 'KNOCKDOWN_COUNT' && state.referee.count >= 1) {
    const digitSprite = getLargeCountDigitSprite(state.referee.count);
    blitSprite(data, digitSprite, COUNT_DIGIT_X, COUNT_DIGIT_Y);
  }

  // Blit final pixel buffer to canvas
  ctx.putImageData(imgData, 0, 0);
}
