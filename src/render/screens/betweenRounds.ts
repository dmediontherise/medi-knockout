import { nesToRgba } from '../nesPalette';
import { drawBitmapText, drawBitmapText2x } from '../sprites/font';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../sprites/blit';
import { FightState } from '../../core/types';
import { OPPONENT_PRESENTATION } from './presentationData';

export function renderBetweenRoundsScreen(
  ctx: CanvasRenderingContext2D,
  state: FightState,
  frame: number
) {
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imgData.data;

  // Background: NES dark navy (0x02)
  const [bgR, bgG, bgB] = nesToRgba(0x02);
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

  const oppInfo = OPPONENT_PRESENTATION[state.opponentId] || OPPONENT_PRESENTATION.aint_man;

  // Outer border
  for (let x = 6; x < CANVAS_WIDTH - 6; x++) {
    setPixel(x, 6, 0x28);
    setPixel(x, CANVAS_HEIGHT - 7, 0x28);
  }
  for (let y = 6; y < CANVAS_HEIGHT - 6; y++) {
    setPixel(6, y, 0x28);
    setPixel(CANVAS_WIDTH - 7, y, 0x28);
  }

  // Header: "ROUND <N> FINISHED"
  const roundNum = state.round || 1;
  drawBitmapText2x(setPixel, `ROUND ${roundNum}`, 72, 16, 0x28);
  drawBitmapText(setPixel, 'FINISHED', 96, 36, 0x20);

  // Divider
  for (let x = 20; x < CANVAS_WIDTH - 20; x++) {
    setPixel(x, 48, 0x20);
  }

  // Corner Stats: HP and points
  // Player Box (Left)
  drawBitmapText(setPixel, 'MEDI', 32, 56, 0x28);
  drawBitmapText(setPixel, `HP: ${state.player.hp}/${state.player.maxHp}`, 32, 68, 0x20);
  drawBitmapText(setPixel, `PTS: ${state.player.points}`, 32, 80, 0x30);

  // Opponent Box (Right)
  drawBitmapText(setPixel, oppInfo.name, 144, 56, 0x16);
  drawBitmapText(setPixel, `HP: ${state.opponent.hp}/${state.opponent.maxHp}`, 144, 68, 0x20);
  drawBitmapText(setPixel, `KD: ${state.opponent.totalKnockdowns}`, 144, 80, 0x30);

  // Coach Corner box (y: 104..190)
  for (let x = 16; x < CANVAS_WIDTH - 16; x++) {
    setPixel(x, 100, 0x20);
    setPixel(x, 196, 0x20);
  }
  for (let y = 100; y <= 196; y++) {
    setPixel(16, y, 0x20);
    setPixel(CANVAS_WIDTH - 17, y, 0x20);
  }

  drawBitmapText(setPixel, "COACH'S CORNER:", 24, 108, 0x28);

  // Split coach tip into multiple lines (up to 26 chars per line)
  const tip = oppInfo.coachTip;
  const words = tip.split(' ');
  const lines: string[] = [];
  let curLine = '';
  for (const w of words) {
    if ((curLine + (curLine ? ' ' : '') + w).length <= 26) {
      curLine = curLine + (curLine ? ' ' : '') + w;
    } else {
      lines.push(curLine);
      curLine = w;
    }
  }
  if (curLine) lines.push(curLine);

  for (let li = 0; li < lines.length; li++) {
    drawBitmapText(setPixel, lines[li], 24, 124 + li * 12, 0x20);
  }

  // Blinking "PRESS START"
  if (Math.floor(frame / 20) % 2 === 0) {
    drawBitmapText(setPixel, 'PRESS START', 84, 212, 0x28);
  }

  ctx.putImageData(imgData, 0, 0);
}
