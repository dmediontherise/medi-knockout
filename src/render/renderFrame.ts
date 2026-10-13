import { FightState } from '../core/types';
import { NES_PALETTE, nesToRgba } from './nesPalette';
import { drawRingBackground } from './sprites/ring';
import { drawBitmapText } from './sprites/font';
import { getOpponentSprite, resolvePlayerSprite, OPPONENT_POSES, PLAYER_POSES } from './poses';
import { REFEREE_SPRITES, getLargeCountDigitSprite } from './sprites/referee';
import { SpriteData } from './sprites/types';
import { SPARK_SPRITE, STAR_SPRITE } from './sprites/effects';

export const CANVAS_WIDTH = 256;
export const CANVAS_HEIGHT = 240;

// Internal frame buffer (256 * 240 * 4 bytes)
let pixelBuffer: ImageData | null = null;

// Helper to blit a SpriteData into the canvas ImageData
function blitSprite(
  data: Uint8ClampedArray,
  sprite: SpriteData,
  destX: number,
  destY: number,
  overrideColor?: number
) {
  for (let sy = 0; sy < sprite.height; sy++) {
    const py = destY + sy;
    if (py < 0 || py >= CANVAS_HEIGHT) continue;
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

    if (inKnockdown) {
      // Draw large count digits in center-top of ring (x: 120, y: 64)
      // Knockdown count is based on state.opponent or player knockdowns or round frame
      // Estimate count from 1..10
      const countNum = Math.min(10, Math.floor((state.opponent.actionFrame || state.player.actionFrame || 0) / 60) + 1);
      const digitSprite = getLargeCountDigitSprite(countNum);
      blitSprite(data, digitSprite, 122, 60);
    }
  }

  // 4. Draw Opponent
  // Opponent sprite is 112-150px tall (e.g. 140px tall).
  // Positioned below HUD (y >= 48) at y = 50, centered at x: 128 ± 8.
  const oppTransform = OPPONENT_POSES[state.opponent.action] || OPPONENT_POSES['IDLE'];
  const oppSprite = getOpponentSprite(state.opponentId, state.opponent.action, frame);

  // Fall logic: slide down over ~30 frames until at most its top 40 rows remain above ring floor (y=190)
  let fallDy = 0;
  if (oppTransform.fall) {
    const actFrame = state.opponent.actionFrame || 0;
    const fallProgress = Math.min(1, actFrame / 30);
    // 50 + 100 = 150 -> leaves top 40 rows above y=190
    fallDy = Math.floor(fallProgress * 100);
  }

  // Shake logic
  let oppShakeX = 0;
  if (oppTransform.shake > 0) {
    const period = state.opponent.action === 'STUNNED' ? 8 : 4;
    const sign = (Math.floor(frame / (period / 2)) % 2 === 0) ? 1 : -1;
    oppShakeX = sign * oppTransform.shake;
  }

  // Breathing offset: 1px vertical breathing on frame 30 window
  const isBreathingFrame = Math.floor(frame / 30) % 2 === 1;
  const breathingDy = (state.opponent.action === 'IDLE' && isBreathingFrame) ? 1 : 0;

  const oppX = Math.round(128 - oppSprite.width / 2) + oppTransform.dx + oppShakeX;
  const oppY = 50 + oppTransform.dy + fallDy + breathingDy;

  // Star opportunity flash effect on opponent
  const oppOverride = (state.opponent.starOpportunity && flash) ? 0x20 : undefined;
  blitSprite(data, oppSprite, oppX, oppY, oppOverride);

  // Opponent Effect Sprites (spark / stars)
  if (oppTransform.effect === 'spark-head') {
    blitSprite(data, SPARK_SPRITE, oppX + Math.floor(oppSprite.width / 2) - 4, oppY + 16);
  } else if (oppTransform.effect === 'spark-body') {
    blitSprite(data, SPARK_SPRITE, oppX + Math.floor(oppSprite.width / 2) - 4, oppY + 50);
  } else if (oppTransform.effect === 'stars') {
    // Circling stars above head
    const angle = (frame * 0.15) % (Math.PI * 2);
    const starX = oppX + Math.floor(oppSprite.width / 2) + Math.round(Math.cos(angle) * 16) - 4;
    const starY = oppY + Math.round(Math.sin(angle) * 6) - 8;
    blitSprite(data, STAR_SPRITE, starX, starY);
  }

  // 5. Draw Player (Seen from behind, small at lower center overlapping opponent's lower body)
  const playerTransform = PLAYER_POSES[state.player.action] || PLAYER_POSES['IDLE'];
  const playerSprite = resolvePlayerSprite(state.player.action, state.player.isExhausted);

  let pShakeX = 0;
  if (playerTransform.shake > 0) {
    const sign = (Math.floor(frame / 2) % 2 === 0) ? 1 : -1;
    pShakeX = sign * playerTransform.shake;
  }

  let pFallDy = 0;
  if (playerTransform.fall) {
    const pActFrame = state.player.actionFrame || 0;
    pFallDy = Math.min(30, Math.floor(pActFrame * 1.5));
  }

  const playerX = Math.round(128 - playerSprite.width / 2) + playerTransform.dx + pShakeX;
  const playerY = 168 + playerTransform.dy + pFallDy;

  blitSprite(data, playerSprite, playerX, playerY);

  // 6. Hit feedback flash (white/red flash on hit)
  if (state.player.action === 'HIT' && flash) {
    blitSprite(data, playerSprite, playerX, playerY, 0x20);
  }

  // Blit final pixel buffer to canvas
  ctx.putImageData(imgData, 0, 0);
}
