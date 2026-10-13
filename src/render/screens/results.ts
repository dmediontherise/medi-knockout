import { nesToRgba } from '../nesPalette';
import { drawBitmapText, drawBitmapText2x } from '../sprites/font';
import { blitSprite, CANVAS_WIDTH, CANVAS_HEIGHT } from '../sprites/blit';
import { PLAYER_WIN, PLAYER_WIN_ANCHOR_X, PLAYER_DOWN, PLAYER_DOWN_ANCHOR_X } from '../sprites/generated/player';
import { FightState } from '../../core/types';
import { OPPONENT_PRESENTATION } from './presentationData';

export function renderResultsScreen(
  ctx: CanvasRenderingContext2D,
  state: FightState,
  frame: number
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;

  const isWin = state.winner === 'PLAYER';
  const oppInfo = OPPONENT_PRESENTATION[state.opponentId] || OPPONENT_PRESENTATION.aint_man;

  // Background: Win is dark blue/navy (0x02), Loss is dark red/maroon (0x06)
  const [bgR, bgG, bgB] = nesToRgba(isWin ? 0x02 : 0x06);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgR;
    data[i + 1] = bgG;
    data[i + 2] = bgB;
    data[i + 3] = 255;
  }

  const setPixel = (x: number, y: number, nesColor: number) => {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
    const [r, g, b] = nesToRgba(nesColor);
    const idx = (y * CANVAS_WIDTH + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  // Outer border
  const borderColor = isWin ? 0x28 : 0x16;
  for (let x = 6; x < CANVAS_WIDTH - 6; x++) {
    setPixel(x, 6, borderColor);
    setPixel(x, CANVAS_HEIGHT - 7, borderColor);
  }
  for (let y = 6; y < CANVAS_HEIGHT - 6; y++) {
    setPixel(6, y, borderColor);
    setPixel(CANVAS_WIDTH - 7, y, borderColor);
  }

  // Result Type: KO!, TKO! or DECISION
  let resultText = 'KO!';
  if (state.result === 'TKO') {
    resultText = 'TKO!';
  } else if (state.result === 'DECISION') {
    resultText = 'DECISION';
  }
  const resultX = Math.round((CANVAS_WIDTH - resultText.length * 16) / 2);
  drawBitmapText2x(setPixel, resultText, resultX, 24, 0x20);

  // Divider
  for (let x = 24; x < CANVAS_WIDTH - 24; x++) {
    setPixel(x, 52, borderColor);
  }

  // Winner banner
  const winnerName = isWin ? 'MEDI' : oppInfo.name;
  const winnerLabel = `WINNER: ${winnerName}`;
  const winnerX = Math.round((CANVAS_WIDTH - winnerLabel.length * 8) / 2);
  drawBitmapText(setPixel, winnerLabel, winnerX, 68, 0x28);

  // Victory / Defeat message & Player sprite
  if (isWin) {
    drawBitmapText2x(setPixel, 'YOU WIN!!', 56, 84, 0x28);
    // Draw WIN player frame
    const winX = 128 - PLAYER_WIN_ANCHOR_X;
    const winY = 205 - (PLAYER_WIN.height - 1);
    blitSprite(data, PLAYER_WIN, winX, winY);
  } else {
    drawBitmapText2x(setPixel, 'YOU LOSE!!', 48, 84, 0x16);
    // Draw DOWN player frame
    const downX = 128 - PLAYER_DOWN_ANCHOR_X;
    const downY = 205 - (PLAYER_DOWN.height - 1);
    blitSprite(data, PLAYER_DOWN, downX, downY);
  }

  // Stats Card
  const statsStartY = 136;
  for (let x = 24; x < CANVAS_WIDTH - 24; x++) {
    setPixel(x, statsStartY - 8, 0x20);
    setPixel(x, statsStartY + 56, 0x20);
  }
  for (let y = statsStartY - 8; y <= statsStartY + 56; y++) {
    setPixel(24, y, 0x20);
    setPixel(CANVAS_WIDTH - 25, y, 0x20);
  }

  drawBitmapText(setPixel, `FINAL SCORE: ${state.player.points.toString().padStart(6, '0')}`, 40, statsStartY + 4, 0x20);
  drawBitmapText(setPixel, `ROUND: ${state.round}`, 40, statsStartY + 20, 0x30);
  drawBitmapText(setPixel, `HITS LANDED: ${state.player.hitsLanded}`, 40, statsStartY + 36, 0x30);

  // Prompt: PRESS START returns to circuit
  if (Math.floor(frame / 20) % 2 === 0) {
    drawBitmapText(setPixel, 'PRESS START', 84, 210, 0x28);
  }

  ctx.putImageData(imgData, 0, 0);
}
