import { FightState } from '../core/types';
import { NES_PALETTE, nesToRgba } from './nesPalette';
import { drawRingBackground } from './sprites/ring';
import { drawBitmapText, drawBitmapText2x } from './sprites/font';
import { getOpponentSprite, resolvePlayerSprite, OPPONENT_POSES, PLAYER_POSES } from './poses';
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
// count the player keeps his idle pose and is shifted to the right by at least
// PLAYER_STEP_ASIDE_SHIFT so his left edge is at x >= PLAYER_STEP_ASIDE_MIN_X.
export function computePlayerDraw(state: FightState): { x: number; y: number; sprite: SpriteData } {
  const aside = isPlayerSteppingAside(state);
  const action = aside ? 'IDLE' : state.player.action;
  const actionFrame = aside ? 0 : (state.player.actionFrame || 0);
  const transform = PLAYER_POSES[action] || PLAYER_POSES['IDLE'];
  const sprite = resolvePlayerSprite(action, state.player.isExhausted);

  let shakeX = 0;
  if (transform.shake > 0) {
    const sign = (Math.floor(actionFrame / 2) % 2 === 0) ? 1 : -1;
    shakeX = sign * transform.shake;
  }

  let fallDy = 0;
  if (transform.fall) {
    fallDy = Math.min(30, Math.floor(actionFrame * 1.5));
  }

  const baseX = Math.round(128 - sprite.width / 2) + transform.dx + shakeX;
  const x = aside ? Math.max(baseX + PLAYER_STEP_ASIDE_SHIFT, PLAYER_STEP_ASIDE_MIN_X) : baseX;
  const y = 168 + transform.dy + fallDy;
  return { x, y, sprite };
}

// Internal frame buffer (256 * 240 * 4 bytes)
let pixelBuffer: ImageData | null = null;

// Helper to blit a SpriteData into the canvas ImageData
function blitSprite(
  data: Uint8ClampedArray,
  sprite: SpriteData,
  destX: number,
  destY: number,
  overrideColor?: number,
  clipMaxY?: number
) {
  for (let sy = 0; sy < sprite.height; sy++) {
    const py = destY + sy;
    if (py < 0 || py >= CANVAS_HEIGHT) continue;
    if (clipMaxY !== undefined && py >= clipMaxY) continue;
    const row = sprite.rows[sy];
    if (!row) continue;

    for (let sx = 0; sx < sprite.width; sx++) {
      const px = destX + sx;
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
// Displays:
// - Points (top left)
// - Opponent HP bar (top)
// - Player HP bar
// - Hearts & Stars icon + counts
// - Round and clock formatted as R<n> m:ss
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
  // E.g. "000000        R1 3:00"
  const pointsStr = state.player.points.toString().padStart(6, '0');
  const clockSecs = Math.max(0, state.gameClockSeconds);
  const mins = Math.floor(clockSecs / 60);
  const secs = (clockSecs % 60).toString().padStart(2, '0');
  const clockStr = `R${state.round} ${mins}:${secs}`;

  drawBitmapText(setHudPixel, pointsStr, 8, 4, 0x20);
  drawBitmapText(setHudPixel, clockStr, 176, 4, 0x20);

  // Line 2: Opponent Name / Opponent Stamina Bar (y: 16)
  // Opponent name or "ENEMY"
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
  // Hearts & Stars: "\x03" (heart) and "\x04" (star)
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

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: FightState
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;
  const frame = state.frame;
  const flash = Math.floor(frame / 8) % 2 === 0;

  // 1. Draw Ring Background & Crowd
  const setPixel = (x: number, y: number, nesColor: number) => {
    const [r, g, b] = nesToRgba(nesColor);
    const idx = (y * CANVAS_WIDTH + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  drawRingBackground(setPixel, frame);

  // 2. Draw HUD (y: 0..47)
  renderHud(data, state, flash);

  // 3. Draw Referee (if KNOCKDOWN_COUNT phase or MATCH_OVER)
  const inKnockdown = state.phase === 'KNOCKDOWN_COUNT';
  const isMatchOver = state.phase === 'MATCH_OVER';

  if (inKnockdown || isMatchOver) {
    const refSprite = inKnockdown ? REFEREE_SPRITES.COUNT : REFEREE_SPRITES.STAND;
    // Draw referee at left side of ring (x: 48, y: 88)
    blitSprite(data, refSprite, 48, 88);
  }

  // 4. Draw Opponent
  // Opponent sprite is 112-150px tall (e.g. 140px tall).
  // Positioned below HUD (y >= 48) at y = 50, centered at x: 128 ± 8.
  const oppActionFrame = state.opponent.actionFrame || 0;
  const oppTransform = OPPONENT_POSES[state.opponent.action] || OPPONENT_POSES['IDLE'];
  const oppSprite = getOpponentSprite(state.opponentId, state.opponent.action, oppActionFrame);

  // Fall logic: slide down over actionFrame 0-30 until at most its top 40 rows remain above ring floor (y=190)
  let fallDy = 0;
  if (oppTransform.fall) {
    const fallProgress = Math.min(1, oppActionFrame / 30);
    // 50 + 100 = 150 -> leaves top 40 rows above y=190
    fallDy = Math.floor(fallProgress * 100);
  }

  // KO blink: from actionFrame 31, KO blinks: hidden on 4-frame windows, every other window
  // e.g. [31, 34]: Math.floor((31-31)/4) = 0 (even -> visible), [35, 38]: 1 (odd -> hidden), etc.
  let isKoHidden = false;
  if (state.opponent.action === 'KO' && oppActionFrame >= 31) {
    const blinkWindow = Math.floor((oppActionFrame - 31) / 4);
    if (blinkWindow % 2 === 1) {
      isKoHidden = true;
    }
  }

  // Taunt bounce: oscillate dy between 0 and -6 over a 16-frame period of actionFrame
  let tauntBounceDy = 0;
  if (state.opponent.action === 'TAUNT') {
    // Phase 0..15: 0..7 goes up 0 to -6, 8..15 goes back down -6 to 0
    const phase = oppActionFrame % 16;
    if (phase < 8) {
      tauntBounceDy = -Math.round((phase / 7) * 6);
    } else {
      tauntBounceDy = -Math.round(((15 - phase) / 7) * 6);
    }
  }

  // Shake logic: function of actionFrame
  let oppShakeX = 0;
  if (oppTransform.shake > 0) {
    const period = state.opponent.action === 'STUNNED' ? 8 : 4;
    const sign = (Math.floor(oppActionFrame / (period / 2)) % 2 === 0) ? 1 : -1;
    oppShakeX = sign * oppTransform.shake;
  }

  // Breathing offset: 1px vertical breathing on frame 30 window (global frame counter per R1)
  const isBreathingFrame = Math.floor(frame / 30) % 2 === 1;
  const breathingDy = (state.opponent.action === 'IDLE' && isBreathingFrame) ? 1 : 0;

  const baseOppDy = state.opponent.action === 'TAUNT' ? 0 : oppTransform.dy;
  const oppX = Math.round(128 - oppSprite.width / 2) + oppTransform.dx + oppShakeX;
  const oppY = 50 + baseOppDy + fallDy + breathingDy + tauntBounceDy;

  if (!isKoHidden) {
    // Star opportunity flash effect on opponent — only during live play, never on a
    // fighter who is already going down (otherwise the fallen opponent renders as a
    // solid white silhouette and loses his own colors).
    const starFlashActive =
      state.phase === 'ROUND_ACTIVE' &&
      state.opponent.action !== 'KNOCKED_DOWN' &&
      state.opponent.action !== 'KO';
    const oppOverride = (state.opponent.starOpportunity && flash && starFlashActive) ? 0x20 : undefined;
    // Opponent is clipped at ring floor line (y < 190) per Requirement 12
    blitSprite(data, oppSprite, oppX, oppY, oppOverride, 190);

    // Opponent Effect Sprites (spark / stars)
    if (oppTransform.effect === 'spark-head') {
      blitSprite(data, SPARK_SPRITE, oppX + Math.floor(oppSprite.width / 2) - 4, oppY + 16);
    } else if (oppTransform.effect === 'spark-body') {
      blitSprite(data, SPARK_SPRITE, oppX + Math.floor(oppSprite.width / 2) - 4, oppY + 50);
    } else if (oppTransform.effect === 'stars') {
      // Circling stars above head using actionFrame
      const angle = (oppActionFrame * 0.15) % (Math.PI * 2);
      const starX = oppX + Math.floor(oppSprite.width / 2) + Math.round(Math.cos(angle) * 16) - 4;
      const starY = oppY + Math.round(Math.sin(angle) * 6) - 8;
      blitSprite(data, STAR_SPRITE, starX, starY);
    }
  }

  // 5. Draw Player (Seen from behind, small at lower center overlapping opponent's lower body)
  const playerActionFrame = state.player.actionFrame || 0;
  const playerDraw = computePlayerDraw(state);
  const playerSprite = playerDraw.sprite;
  const playerX = playerDraw.x;
  const playerY = playerDraw.y;

  blitSprite(data, playerSprite, playerX, playerY);

  // 6. Hit feedback flash (white/red flash on hit, first 4 frames of actionFrame)
  if (state.player.action === 'HIT' && playerActionFrame <= 3) {
    blitSprite(data, playerSprite, playerX, playerY, 0x20);
  }

  // 7. In-fight canvas feedback messages (Requirement 10)
  // When feedbackMessage is set during a fight, drawn in 8x8 font at 2x, centered, inside y 52-80 on a black backing bar
  if (state.feedbackMessage) {
    const msg = state.feedbackMessage;
    const charWidth = 16; // 8 * 2
    const textWidth = msg.length * charWidth;
    const textHeight = 16; // 8 * 2
    const startX = Math.max(0, Math.round((CANVAS_WIDTH - textWidth) / 2));
    const startY = 56; // Centered inside 52..80 (total height 28, text height 16, padding top/bot 6)

    // Black backing bar
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

    // Draw text in NES yellow/gold (0x28) or white (0x20)
    drawBitmapText2x(setMsgPixel, msg, startX, startY, 0x28);
  }

  // 8. Knockdown count digit (Requirement 8)
  // Drawn last, from the real referee count, so nothing covers it.
  if (state.phase === 'KNOCKDOWN_COUNT' && state.referee.count >= 1) {
    const digitSprite = getLargeCountDigitSprite(state.referee.count);
    blitSprite(data, digitSprite, COUNT_DIGIT_X, COUNT_DIGIT_Y);
  }

  // Blit final pixel buffer to canvas
  ctx.putImageData(imgData, 0, 0);
}
