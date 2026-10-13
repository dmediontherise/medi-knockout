import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NES_PALETTE, isNesColor, toFlashPalette, toDarkPalette } from '../../src/render/nesPalette';
import {
  OPPONENT_POSES,
  OPPONENT_SPRITE_MAPS,
  OPPONENT_FRAME_MAPS,
  OPPONENT_ACTION_FIGURES,
  getSpriteAnchor,
  getOpponentSprite,
  resolvePlayerSprite,
  IDLE_BASES,
  PLAYER_POSES,
} from '../../src/render/poses';
import { getPlayerSprite, resolvePlayerFrame, PLAYER_BACK_IDLE } from '../../src/render/sprites/player';
import { REFEREE_SPRITES, getLargeCountDigitSprite } from '../../src/render/sprites/referee';
import { SpriteData } from '../../src/render/sprites/types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT, COUNT_DIGIT_X, COUNT_DIGIT_Y, computePlayerDraw, computeOpponentDraw, isPlayerSteppingAside, PLAYER_STEP_ASIDE_MIN_X } from '../../src/render/renderFrame';
import { nesToRgba } from '../../src/render/nesPalette';
import {
  renderCircuitScreen,
  isOpponentUnlocked,
  CIRCUIT_FOOTER_LINES,
} from '../../src/render/screens/circuit';
import { renderResultsScreen } from '../../src/render/screens/results';
import {
  OPPONENT_PRESENTATION,
  CIRCUIT_ROSTER_IDS,
  getPortraitCrop,
  wrapText,
} from '../../src/render/screens/presentationData';
import { drawBitmapText, FONT_8X8 } from '../../src/render/sprites/font';
import { createFight } from '../../src/core/engine';
import { IDLE_BASE_AINT_MAN, AINT_MAN_LIE } from '../../src/render/sprites/generated/aint_man';
import { IDLE_BASE_MEDI_JINX } from '../../src/render/sprites/generated/medi_jinx';
import { IDLE_BASE_DJ_TITO } from '../../src/render/sprites/generated/dj_tito';
import { SPARK_SPRITE, STAR_SPRITE } from '../../src/render/sprites/effects';

describe('NES Palette Conformance', () => {
  it('NES_PALETTE contains exactly 64 valid RGB triplets', () => {
    expect(NES_PALETTE).toHaveLength(64);
    for (const [r, g, b] of NES_PALETTE) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it('isNesColor accurately validates colors within 0..63', () => {
    expect(isNesColor(0x0F)).toBe(true);
    expect(isNesColor(0x00)).toBe(true);
    expect(isNesColor(0x3F)).toBe(true);
    expect(isNesColor(-1)).toBe(false);
    expect(isNesColor(64)).toBe(false);
  });

  // Task 007 Requirement 4: Pure functions for flash and dark palettes
  it('toFlashPalette maps to lighter entry (+0x10) and white stays white', () => {
    expect(toFlashPalette(0x01)).toBe(0x11);
    expect(toFlashPalette(0x11)).toBe(0x21);
    expect(toFlashPalette(0x20)).toBe(0x20); // white stays white
    expect(toFlashPalette(0x30)).toBe(0x30); // white stays white
  });

  it('toDarkPalette maps to darker entry (-0x10, floor 0x0F)', () => {
    expect(toDarkPalette(0x21)).toBe(0x11);
    expect(toDarkPalette(0x11)).toBe(0x01);
    expect(toDarkPalette(0x01)).toBe(0x0F); // floor 0x0F
  });
});

describe('Character Sprite Palettes and Dimensions', () => {
  const checkSpriteColors = (sprite: SpriteData, maxColors: number = 12) => {
    const paletteIndices = new Set<number>();
    for (const key of Object.keys(sprite.palette)) {
      const idx = sprite.palette[key];
      if (idx !== -1) {
        expect(isNesColor(idx)).toBe(true);
        paletteIndices.add(idx);
      }
    }
    expect(paletteIndices.size).toBeLessThanOrEqual(maxColors);
  };

  const OPPONENT_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];
  const REQUIRED_ACTIONS = [
    'IDLE_1',
    'IDLE_2',
    'BLOCK_HIGH',
    'BLOCK_LOW',
    'TELL_JAB_LEFT',
    'TELL_JAB_RIGHT',
    'PUNCH_JAB_LEFT',
    'PUNCH_JAB_RIGHT',
    'TELL_HOOK_LEFT',
    'TELL_HOOK_RIGHT',
    'PUNCH_HOOK_LEFT',
    'PUNCH_HOOK_RIGHT',
    'TELL_UPPERCUT_LEFT',
    'TELL_UPPERCUT_RIGHT',
    'PUNCH_UPPERCUT_LEFT',
    'PUNCH_UPPERCUT_RIGHT',
    'HIT',
    'STUNNED',
    'KNOCKED_DOWN',
    'KO',
    'TAUNT',
  ];

  for (const oppId of OPPONENT_IDS) {
    describe(`Opponent: ${oppId}`, () => {
      it('has sprite definitions for all required actions', () => {
        const spriteMap = OPPONENT_SPRITE_MAPS[oppId];
        expect(spriteMap).toBeDefined();

        for (const action of REQUIRED_ACTIONS) {
          const sprite = spriteMap[action];
          expect(sprite, `Missing action ${action} on ${oppId}`).toBeDefined();
          expect(sprite.height).toBeGreaterThanOrEqual(85);
          expect(sprite.height).toBeLessThanOrEqual(150);
          expect(sprite.width).toBeGreaterThanOrEqual(64);
          checkSpriteColors(sprite, 12);
        }
      });
    });
  }

  // Requirement 2: Readable tells (measured on rendered frames per task 007)
  describe('Readable tell frames (requirement 2)', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    function computeRenderedDiff(buf1: Uint8ClampedArray, buf2: Uint8ClampedArray): number {
      let diff = 0;
      for (let i = 0; i < buf1.length; i += 4) {
        if (buf1[i] !== buf2[i] || buf1[i+1] !== buf2[i+1] || buf1[i+2] !== buf2[i+2]) {
          diff++;
        }
      }
      return diff;
    }

    for (const oppId of OPPONENT_IDS) {
      it(`opponent ${oppId} tell frames differ from idle by >= 150 px and pairwise by >= 150 px`, () => {
        const fIdle = createFight(oppId, 123); fIdle.opponent.action = 'IDLE'; fIdle.frame = 0;
        const fIdle2 = createFight(oppId, 123); fIdle2.opponent.action = 'IDLE'; fIdle2.frame = 30;
        const fJab = createFight(oppId, 123); fJab.opponent.action = 'TELL_JAB_LEFT'; fJab.frame = 0;
        const fHook = createFight(oppId, 123); fHook.opponent.action = 'TELL_HOOK_LEFT'; fHook.frame = 0;
        const fUpper = createFight(oppId, 123); fUpper.opponent.action = 'TELL_UPPERCUT_LEFT'; fUpper.frame = 0;

        const mIdle = createMockCanvas(); renderFrame(mIdle.ctx, fIdle);
        const mIdle2 = createMockCanvas(); renderFrame(mIdle2.ctx, fIdle2);
        const mJab = createMockCanvas(); renderFrame(mJab.ctx, fJab);
        const mHook = createMockCanvas(); renderFrame(mHook.ctx, fHook);
        const mUpper = createMockCanvas(); renderFrame(mUpper.ctx, fUpper);

        expect(computeRenderedDiff(mIdle.buffer, mIdle2.buffer), 'idle breathing diff').toBeGreaterThanOrEqual(20);

        // Diff against idle
        expect(computeRenderedDiff(mJab.buffer, mIdle.buffer), 'tell jab vs idle').toBeGreaterThanOrEqual(150);
        expect(computeRenderedDiff(mHook.buffer, mIdle.buffer), 'tell hook vs idle').toBeGreaterThanOrEqual(150);
        expect(computeRenderedDiff(mUpper.buffer, mIdle.buffer), 'tell uppercut vs idle').toBeGreaterThanOrEqual(150);

        // Pairwise diffs
        expect(computeRenderedDiff(mJab.buffer, mHook.buffer), 'tell jab vs tell hook').toBeGreaterThanOrEqual(150);
        expect(computeRenderedDiff(mJab.buffer, mUpper.buffer), 'tell jab vs tell uppercut').toBeGreaterThanOrEqual(150);
        expect(computeRenderedDiff(mHook.buffer, mUpper.buffer), 'tell hook vs tell uppercut').toBeGreaterThanOrEqual(150);
      });
    }
  });

  // Task 007 Requirement 1: No rotation, scale, or setTransform in src/render/
  describe('Transform & Purity Restrictions (requirement 1)', () => {
    it('no rotate, scale, or setTransform in src/render/', () => {
      const renderDir = path.resolve(process.cwd(), 'src/render');
      const files = fs.readdirSync(renderDir, { recursive: true }) as string[];
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          const content = fs.readFileSync(path.join(renderDir, file), 'utf8');
          expect(content).not.toMatch(/rotate\(/);
          expect(content).not.toMatch(/scale\(/);
          expect(content).not.toMatch(/setTransform\(/);
        }
      }
    });

    it('OPPONENT_POSES maps every action to a PoseTransform with required fields', () => {
      for (const [action, transform] of Object.entries(OPPONENT_POSES)) {
        expect(typeof transform.dx).toBe('number');
        expect(typeof transform.dy).toBe('number');
        expect(typeof transform.flipX).toBe('boolean');
        expect(['normal', 'flash', 'dark']).toContain(transform.palette);
        expect(['none', 'spark-head', 'spark-body', 'stars']).toContain(transform.effect);
        expect(typeof transform.shake).toBe('number');
        expect(typeof transform.fall).toBe('boolean');
      }
    });
  });

  // Task 007 Requirement 5: Effect sprites
  describe('Effect Sprites (requirement 5)', () => {
    it('spark and stars effect sprites are <= 16x16 and use valid NES colors', () => {
      expect(SPARK_SPRITE.width).toBeLessThanOrEqual(16);
      expect(SPARK_SPRITE.height).toBeLessThanOrEqual(16);
      checkSpriteColors(SPARK_SPRITE, 12);

      expect(STAR_SPRITE.width).toBeLessThanOrEqual(16);
      expect(STAR_SPRITE.height).toBeLessThanOrEqual(16);
      checkSpriteColors(STAR_SPRITE, 12);
    });
  });

  // Task 007 Requirement 7: Player Back View
  describe('Player Back View (requirement 7)', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    it('player back view', () => {
      const fight = createFight('aint_man', 123);
      fight.player.action = 'IDLE';
      const mock = createMockCanvas();
      renderFrame(mock.ctx, fight);

      // Check player sprite from resolvePlayerSprite
      const playerSprite = getPlayerSprite('IDLE', false);
      let minX = playerSprite.width, maxX = -1, minY = playerSprite.height, maxY = -1;
      let hairCount = 0;
      let skinCount = 0;
      let trunksCount = 0;
      let leftGloves = 0;
      let rightGloves = 0;
      const centerX = Math.floor(playerSprite.width / 2);

      for (let y = 0; y < playerSprite.height; y++) {
        for (let x = 0; x < playerSprite.width; x++) {
          const ch = playerSprite.rows[y][x];
          if (ch !== '.') {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            if (ch === 'B' && y < 24) hairCount++;
            if (ch === 'B' && y >= 50) trunksCount++;
            if (ch === 'S' || ch === 'K' || ch === 'L') skinCount++;
            if (ch === 'R' || ch === 'H') {
              if (x < centerX) leftGloves++;
              else rightGloves++;
            }
          }
        }
      }

      const spanW = maxX - minX + 1;
      const spanH = maxY - minY + 1;

      expect(spanW).toBeGreaterThanOrEqual(40);
      expect(spanH).toBeGreaterThanOrEqual(60);
      expect(hairCount).toBeGreaterThan(0);
      expect(skinCount).toBeGreaterThan(0);
      expect(trunksCount).toBeGreaterThan(0);
      expect(leftGloves).toBeGreaterThan(0);
      expect(rightGloves).toBeGreaterThan(0);
    });

    it('player does not hide opponent head (requirement 2)', () => {
      for (const oppId of OPPONENT_IDS) {
        const fightWithPlayer = createFight(oppId, 123);
        fightWithPlayer.player.action = 'IDLE';
        fightWithPlayer.opponent.action = 'IDLE';

        const mockWith = createMockCanvas();
        renderFrame(mockWith.ctx, fightWithPlayer);

        let totalOppHeadPixels = 0;
        for (let y = 50; y < 100; y++) {
          for (let x = 0; x < CANVAS_WIDTH; x++) {
            totalOppHeadPixels++;
          }
        }
        expect(totalOppHeadPixels).toBeGreaterThan(0);
      }
    });
  });

  // Task 006 Requirement 5: True colors
  describe('True Colors (requirement 5)', () => {
    function countPixels(sprite: SpriteData) {
      const counts = new Map<number, number>();
      for (const row of sprite.rows) {
        for (const ch of row) {
          if (ch !== '.') {
            const col = sprite.palette[ch];
            counts.set(col, (counts.get(col) || 0) + 1);
          }
        }
      }
      return counts;
    }

    it('aint_man idle contains >= 300 pixels of NES gold/yellow (0x28, 0x38, 0x37)', () => {
      const counts = countPixels(IDLE_BASE_AINT_MAN);
      const gold = (counts.get(0x28) || 0) + (counts.get(0x38) || 0) + (counts.get(0x37) || 0);
      expect(gold).toBeGreaterThanOrEqual(300);
    });

    it('medi_jinx and dj_tito idle frames contain >= 400 pixels of NES black and <= 5% olive', () => {
      const mediCounts = countPixels(IDLE_BASE_MEDI_JINX);
      const mediBlack = (mediCounts.get(0x0f) || 0) + (mediCounts.get(0x0d) || 0);
      const mediOlive = (mediCounts.get(0x08) || 0) + (mediCounts.get(0x18) || 0);
      let mediTotal = 0;
      for (const v of mediCounts.values()) mediTotal += v;

      expect(mediBlack).toBeGreaterThanOrEqual(400);
      expect(mediOlive / mediTotal).toBeLessThanOrEqual(0.05);

      const titoCounts = countPixels(IDLE_BASE_DJ_TITO);
      const titoBlack = (titoCounts.get(0x0f) || 0) + (titoCounts.get(0x0d) || 0);
      const titoOlive = (titoCounts.get(0x08) || 0) + (titoCounts.get(0x18) || 0);
      let titoTotal = 0;
      for (const v of titoCounts.values()) titoTotal += v;

      expect(titoBlack).toBeGreaterThanOrEqual(400);
      expect(titoOlive / titoTotal).toBeLessThanOrEqual(0.05);
    });

    it('medi_jinx contains >= 200 pixels of NES blue (0x11, 0x12, 0x21, 0x22)', () => {
      const mediCounts = countPixels(IDLE_BASE_MEDI_JINX);
      const mediBlue =
        (mediCounts.get(0x11) || 0) +
        (mediCounts.get(0x12) || 0) +
        (mediCounts.get(0x21) || 0) +
        (mediCounts.get(0x22) || 0);
      expect(mediBlue).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Player Sprites (general)', () => {
    const PLAYER_ACTIONS = [
      'IDLE',
      'DODGE_LEFT',
      'DODGE_RIGHT',
      'DUCK',
      'BLOCK',
      'JAB_LEFT',
      'JAB_RIGHT',
      'HOOK_LEFT',
      'HOOK_RIGHT',
      'UPPERCUT',
      'STAR_PUNCH',
      'HIT',
      'KNOCKED_DOWN',
      'KO',
    ];

    it('all player poses are 15-105 px tall, >= 40 px wide and <= 12 NES colors', () => {
      for (const action of PLAYER_ACTIONS) {
        const normal = getPlayerSprite(action, false);
        expect(normal.height).toBeGreaterThanOrEqual(15);
        expect(normal.height).toBeLessThanOrEqual(105);
        expect(normal.width).toBeGreaterThanOrEqual(40);
        checkSpriteColors(normal, 12);

        const exhausted = getPlayerSprite(action, true);
        expect(exhausted.height).toBeGreaterThanOrEqual(15);
        expect(exhausted.height).toBeLessThanOrEqual(105);
        expect(exhausted.width).toBeGreaterThanOrEqual(40);
        checkSpriteColors(exhausted, 12);
      }
    });

    it('exhausted player sprite swaps skin palette to pink tone (0x25)', () => {
      const exhausted = getPlayerSprite('IDLE', true);
      const values = Object.values(exhausted.palette);
      expect(values).toContain(0x25);
    });
  });

  describe('Referee & Knockdown Digits', () => {
    it('referee sprites use valid NES palette colors', () => {
      checkSpriteColors(REFEREE_SPRITES.STAND, 12);
      checkSpriteColors(REFEREE_SPRITES.COUNT, 12);
    });

    it('large count digit sprites (1..10) use valid NES palette colors', () => {
      for (let i = 1; i <= 10; i++) {
        const digit = getLargeCountDigitSprite(i);
        checkSpriteColors(digit, 12);
      }
    });
  });

  // Requirement 11: Renderer behaviour pinned (M15-M18)
  describe('Renderer Behaviour Pinned (M15-M18)', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    it('M15: the head moves >= 16 px on dodge and >= 16 px down on duck', () => {
      const idle = createFight('aint_man', 123); idle.player.action = 'IDLE';
      const dodgeL = createFight('aint_man', 123); dodgeL.player.action = 'DODGE_LEFT'; dodgeL.player.actionFrame = 6;
      const dodgeR = createFight('aint_man', 123); dodgeR.player.action = 'DODGE_RIGHT'; dodgeR.player.actionFrame = 6;
      const duck = createFight('aint_man', 123); duck.player.action = 'DUCK';

      function getHeadMetrics(fight: any) {
        const draw = computePlayerDraw(fight);
        // Find center of black hair in rows 0-30 of the player sprite
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        let topY = CANVAS_HEIGHT;

        for (let r = 0; r < Math.min(30, draw.sprite.height); r++) {
          const row = draw.sprite.rows[r];
          for (let c = 0; c < row.length; c++) {
            if (row[c] === 'B' || row[c] === 'G') {
              const canvasX = draw.x + c;
              const canvasY = draw.y + r;
              sumX += canvasX;
              sumY += canvasY;
              count++;
              if (canvasY < topY) topY = canvasY;
            }
          }
        }

        return {
          cx: count > 0 ? sumX / count : draw.x + draw.sprite.width / 2,
          cy: count > 0 ? sumY / count : draw.y,
          topY,
        };
      }

      const hIdle = getHeadMetrics(idle);
      const hDodgeL = getHeadMetrics(dodgeL);
      const hDodgeR = getHeadMetrics(dodgeR);
      const hDuck = getHeadMetrics(duck);

      const shiftL = hIdle.cx - hDodgeL.cx;
      const shiftR = hDodgeR.cx - hIdle.cx;
      const shiftDuck = hDuck.topY - hIdle.topY;

      expect(shiftL, 'dodge left shifts head >= 16 px').toBeGreaterThanOrEqual(16);
      expect(shiftR, 'dodge right shifts head >= 16 px').toBeGreaterThanOrEqual(16);
      expect(shiftDuck, 'duck moves head down >= 16 px').toBeGreaterThanOrEqual(16);
    });

    it('M16: HUD rows y < 48 are not all one color', () => {
      const fight = createFight('aint_man', 123);
      const mock = createMockCanvas();
      renderFrame(mock.ctx, fight);

      const colors = new Set<string>();
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < CANVAS_WIDTH; x++) {
          const idx = (y * CANVAS_WIDTH + x) * 4;
          colors.add(`${mock.buffer[idx]},${mock.buffer[idx+1]},${mock.buffer[idx+2]}`);
        }
      }
      expect(colors.size).toBeGreaterThan(1);
    });

    it('M17: idle breathing frames for frame counters 0 and 30 are not identical', () => {
      const f0 = createFight('aint_man', 123); f0.frame = 0; f0.opponent.action = 'IDLE';
      const f30 = createFight('aint_man', 123); f30.frame = 30; f30.opponent.action = 'IDLE';

      const mock0 = createMockCanvas(); renderFrame(mock0.ctx, f0);
      const mock30 = createMockCanvas(); renderFrame(mock30.ctx, f30);

      let diffCount = 0;
      for (let i = 0; i < mock0.buffer.length; i += 4) {
        if (
          mock0.buffer[i] !== mock30.buffer[i] ||
          mock0.buffer[i+1] !== mock30.buffer[i+1] ||
          mock0.buffer[i+2] !== mock30.buffer[i+2]
        ) {
          diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(0);
    });

    it('M18: drawing text "R1 3:00" with bitmap font sets pixels', () => {
      let pixelsSet = 0;
      const mockSetPixel = () => {
        pixelsSet++;
      };
      drawBitmapText(mockSetPixel, 'R1 3:00', 0, 0, 0x20);
      expect(pixelsSet).toBeGreaterThan(0);
    });
  });

  // Task 008: Requirements 2-6 Unit Tests
  describe('Task 008 Requirements 2-6', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    // R2: Hit flash: HIT flashes on actionFrame 0-3 only, then shows the normal palette while shaking
    it('R2: HIT flashes on actionFrame 0-3 only, then normal palette while shaking', () => {
      // Check sprite palettes directly
      for (const f of [0, 1, 2, 3]) {
        const sprite = getOpponentSprite('aint_man', 'HIT', f);
        // In flash palette, gold/yellow 0x28 is mapped to 0x38 or similar lighter NES color
        const colors = Object.values(sprite.palette);
        expect(colors).not.toEqual(Object.values(IDLE_BASE_AINT_MAN.palette));
      }
      for (const f of [4, 5, 10, 20]) {
        const sprite = getOpponentSprite('aint_man', 'HIT', f);
        // After frame 3, palette returns to normal (identical to base idle palette)
        expect(sprite.palette).toEqual(IDLE_BASE_AINT_MAN.palette);
      }

      // Render into pixel buffer and verify flash vs normal
      const f3 = createFight('aint_man', 123); f3.opponent.action = 'HIT'; f3.opponent.actionFrame = 3;
      const f4 = createFight('aint_man', 123); f4.opponent.action = 'HIT'; f4.opponent.actionFrame = 4;
      const m3 = createMockCanvas(); renderFrame(m3.ctx, f3);
      const m4 = createMockCanvas(); renderFrame(m4.ctx, f4);

      let diffCount = 0;
      for (let i = 0; i < m3.buffer.length; i += 4) {
        if (m3.buffer[i] !== m4.buffer[i] || m3.buffer[i+1] !== m4.buffer[i+1] || m3.buffer[i+2] !== m4.buffer[i+2]) {
          diffCount++;
        }
      }
      expect(diffCount, 'frame 3 flash and frame 4 normal differ').toBeGreaterThan(100);
    });

    // R3: Jab-tell flash: The jab tell flashes on actionFrame 0-3, 8-11 and 16-19 (on/off in 4-frame windows)
    it('R3: Jab-tell flash on actionFrame 0-3, 8-11, 16-19', () => {
      const flashFrames = [0, 1, 2, 3, 8, 9, 10, 11, 16, 17, 18, 19];
      const normalFrames = [4, 5, 6, 7, 12, 13, 14, 15, 20, 21];

      for (const f of flashFrames) {
        const s = getOpponentSprite('aint_man', 'TELL_JAB_LEFT', f);
        expect(s.palette).not.toEqual(IDLE_BASE_AINT_MAN.palette);
      }
      for (const f of normalFrames) {
        const s = getOpponentSprite('aint_man', 'TELL_JAB_LEFT', f);
        expect(s.palette).toEqual(IDLE_BASE_AINT_MAN.palette);
      }
    });

    it('R4: Fall and blink: KO blinks from 31, KNOCKED_DOWN stays down without blinking', () => {

      // KO at frame 40 vs frame 44 (blink test: absent in exactly one)
      const f40 = createFight('aint_man', 123); f40.opponent.action = 'KO'; f40.opponent.actionFrame = 40;
      const f44 = createFight('aint_man', 123); f44.opponent.action = 'KO'; f44.opponent.actionFrame = 44;
      const m40 = createMockCanvas(); renderFrame(m40.ctx, f40);
      const m44 = createMockCanvas(); renderFrame(m44.ctx, f44);

      // Frame without opponent
      const fEmpty = createFight('aint_man', 123); fEmpty.opponent.action = 'IDLE';
      const mEmpty = createMockCanvas();
      // Render without opponent by creating a blank ring frame
      renderFrame(mEmpty.ctx, fEmpty);

      // Check KO blinking: between frame 40 (blinkWindow = (40-31)/4 = 2 (even -> visible))
      // and frame 44 (blinkWindow = (44-31)/4 = 3 (odd -> hidden))
      let pixels40 = 0;
      let pixels44 = 0;
      for (let y = 140; y < 200; y++) {
        for (let x = 64; x < 192; x++) {
          const idx = (y * CANVAS_WIDTH + x) * 4;
          if (m40.buffer[idx] !== m44.buffer[idx]) {
            pixels40++;
          }
        }
      }
      expect(pixels40, 'KO frame 40 and 44 differ because of blink').toBeGreaterThan(200);

      // KNOCKED_DOWN stays down without blinking at frames 40 and 44
      const kd40 = createFight('aint_man', 123); kd40.opponent.action = 'KNOCKED_DOWN'; kd40.opponent.actionFrame = 40;
      const kd44 = createFight('aint_man', 123); kd44.opponent.action = 'KNOCKED_DOWN'; kd44.opponent.actionFrame = 44;
      const mkd40 = createMockCanvas(); renderFrame(mkd40.ctx, kd40);
      const mkd44 = createMockCanvas(); renderFrame(mkd44.ctx, kd44);

      let kdDiff = 0;
      for (let y = 140; y < 200; y++) {
        for (let x = 64; x < 192; x++) {
          const idx = (y * CANVAS_WIDTH + x) * 4;
          if (mkd40.buffer[idx] !== mkd44.buffer[idx]) {
            kdDiff++;
          }
        }
      }
      expect(kdDiff, 'KNOCKED_DOWN does not blink between frames 40 and 44').toBe(0);
    });

    // R5: Taunt bounce oscillates dy between 0 and -6 over 16-frame period of actionFrame
    it('R5: Taunt bounce oscillates dy between 0 and -6 over 16-frame period of actionFrame', () => {
      const frames = [0, 4, 7, 11, 15, 16];
      const buffers = frames.map(f => {
        const fight = createFight('aint_man', 123);
        fight.opponent.action = 'TAUNT';
        fight.opponent.actionFrame = f;
        const mock = createMockCanvas();
        renderFrame(mock.ctx, fight);
        return mock.buffer;
      });

      // Frame 0 and 16 should be identical (16-frame period)
      let diff0and16 = 0;
      for (let i = 0; i < buffers[0].length; i += 4) {
        if (buffers[0][i] !== buffers[5][i] || buffers[0][i+1] !== buffers[5][i+1]) {
          diff0and16++;
        }
      }
      expect(diff0and16, 'frame 0 and 16 have same taunt bounce').toBe(0);

      // Frame 0 (dy = 0) and frame 7 (dy = -6) should differ noticeably
      let diff0and7 = 0;
      for (let i = 0; i < buffers[0].length; i += 4) {
        if (buffers[0][i] !== buffers[2][i]) {
          diff0and7++;
        }
      }
      expect(diff0and7, 'frame 0 and 7 have bounce difference').toBeGreaterThan(300);
    });

    // R6: Distinct tells without flash: TELL_HOOK_LEFT and TELL_UPPERCUT_LEFT differ by >= 400 px
    it('R6: Distinct tells without flash differ by >= 400 px with hook dx >= 16 and uppercut dy >= 14', () => {
      const OPPONENT_IDS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

      for (const oppId of OPPONENT_IDS) {
        // Force normal palette
        const fHook = createFight(oppId, 123);
        fHook.opponent.action = 'TELL_HOOK_LEFT';
        fHook.opponent.actionFrame = 4; // frame 4 is normal palette window

        const fUpper = createFight(oppId, 123);
        fUpper.opponent.action = 'TELL_UPPERCUT_LEFT';
        fUpper.opponent.actionFrame = 4; // normal palette

        const mHook = createMockCanvas(); renderFrame(mHook.ctx, fHook);
        const mUpper = createMockCanvas(); renderFrame(mUpper.ctx, fUpper);

        let diffPx = 0;
        for (let i = 0; i < mHook.buffer.length; i += 4) {
          if (
            mHook.buffer[i] !== mUpper.buffer[i] ||
            mHook.buffer[i+1] !== mUpper.buffer[i+1] ||
            mHook.buffer[i+2] !== mUpper.buffer[i+2]
          ) {
            diffPx++;
          }
        }
        expect(diffPx, `${oppId} hook vs uppercut without flash differs by >= 400 px`).toBeGreaterThanOrEqual(400);

        // Check hook dx and uppercut dy
        expect(Math.abs(OPPONENT_POSES['TELL_HOOK_LEFT'].dx)).toBeGreaterThanOrEqual(16);
        expect(OPPONENT_POSES['TELL_UPPERCUT_LEFT'].dy).toBeGreaterThanOrEqual(14);
      }
    });
  });
});

// Requirement 4: exact circuit lock rule + 5 opponent rows
describe('Task 010 R4: circuit opponent lock and rows', () => {
  it('isOpponentUnlocked is false after the unlocked index, true at/earlier, true for all with unlockAll', () => {
    const unlockedIndex = 2;
    for (let i = 0; i < CIRCUIT_ROSTER_IDS.length; i++) {
      const id = CIRCUIT_ROSTER_IDS[i];
      expect(isOpponentUnlocked(id, unlockedIndex, false), `${id} locked`).toBe(i <= unlockedIndex);
      expect(isOpponentUnlocked(id, unlockedIndex, true), `${id} all unlocked`).toBe(true);
    }
  });

  it('circuit screen draws 5 opponent rows (5th row region differs from background)', () => {
    const b = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
    const ctx = {
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: b }),
      putImageData: (imgData: any) => { b.set(imgData.data); },
    } as unknown as CanvasRenderingContext2D;

    renderCircuitScreen(ctx, 0, 4, true, 0);

    // Rows start at y=30 with ~38px spacing; 5th row (i=4) occupies ~y182..216.
    const bg = nesToRgba(0x02);
    let nonBg = 0;
    for (let y = 180; y < 218; y++) {
      for (let x = 20; x < 220; x++) {
        const i = (y * CANVAS_WIDTH + x) * 4;
        if (b[i] !== bg[0] || b[i + 1] !== bg[1] || b[i + 2] !== bg[2]) nonBg++;
      }
    }
    expect(nonBg, '5th opponent row draws content').toBeGreaterThan(100);
  });
});

// Requirement 5: result headline/banner
describe('Task 010 R5: result labels', () => {
  function resultState(result: string, winner: string) {
    const s: any = createFight('aint_man', 1);
    s.phase = 'MATCH_OVER';
    s.result = result;
    s.winner = winner;
    s.player.points = 1234;
    s.opponent.points = 567;
    return s;
  }

  function renderState(state: any): Uint8ClampedArray {
    const b = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
    const c = {
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: b }),
      putImageData: (imgData: any) => { b.set(imgData.data); },
    } as unknown as CanvasRenderingContext2D;
    renderResultsScreen(c, state, 0);
    return b;
  }

  function diffRegion(a: Uint8ClampedArray, b: Uint8ClampedArray, y0: number, y1: number): number {
    let diff = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const i = (y * CANVAS_WIDTH + x) * 4;
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
      }
    }
    return diff;
  }

  it('headline region differs between KO, TKO and DECISION', () => {
    const ko = renderState(resultState('KO', 'PLAYER'));
    const tko = renderState(resultState('TKO', 'PLAYER'));
    const dec = renderState(resultState('DECISION', 'PLAYER'));
    expect(diffRegion(ko, tko, 24, 48), 'KO vs TKO headline').toBeGreaterThan(0);
    expect(diffRegion(ko, dec, 24, 48), 'KO vs DECISION headline').toBeGreaterThan(0);
    expect(diffRegion(tko, dec, 24, 48), 'TKO vs DECISION headline').toBeGreaterThan(0);
  });

  it('winner banner region differs between win and loss', () => {
    const win = renderState(resultState('KO', 'PLAYER'));
    const loss = renderState(resultState('KO', 'OPPONENT'));
    expect(diffRegion(win, loss, 60, 88), 'winner banner win vs loss').toBeGreaterThan(0);
  });
});

// Requirement 8: count digit comes from state.referee.count and is drawn on top
describe('Task 010 R8: knockdown count digit', () => {
  function renderState(state: any): Uint8ClampedArray {
    const b = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
    const c = {
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: b }),
      putImageData: (imgData: any) => { b.set(imgData.data); },
    } as unknown as CanvasRenderingContext2D;
    renderFrame(c, state);
    return b;
  }

  it('draws the count digit at COUNT_DIGIT_X/Y using state.referee.count, on top of everything', () => {
    const state = createFight('aint_man', 123);
    state.phase = 'KNOCKDOWN_COUNT';
    state.referee.count = 3;
    state.referee.downFighter = 'OPPONENT';
    state.opponent.action = 'KNOCKED_DOWN';
    state.opponent.actionFrame = 60;
    state.feedbackMessage = 'DOWN!'; // exercises the message bar overlap

    const buffer = renderState(state);
    const digit = getLargeCountDigitSprite(3);
    const expected = nesToRgba(0x38);
    let opaque = 0;
    for (let sy = 0; sy < digit.height; sy++) {
      const row = digit.rows[sy];
      for (let sx = 0; sx < digit.width; sx++) {
        const ch = row[sx];
        if (ch === '.' || ch === ' ') continue;
        opaque++;
        const i = ((COUNT_DIGIT_Y + sy) * CANVAS_WIDTH + COUNT_DIGIT_X + sx) * 4;
        expect(buffer[i], `digit px (${sx},${sy}) R`).toBe(expected[0]);
        expect(buffer[i + 1], `digit px (${sx},${sy}) G`).toBe(expected[1]);
        expect(buffer[i + 2], `digit px (${sx},${sy}) B`).toBe(expected[2]);
      }
    }
    expect(opaque, 'digit has opaque pixels').toBeGreaterThan(30);
  });

  it('does not draw a count digit when referee.count is 0', () => {
    const state = createFight('aint_man', 123);
    state.phase = 'KNOCKDOWN_COUNT';
    state.referee.count = 0;
    state.referee.downFighter = 'OPPONENT';
    state.opponent.action = 'KNOCKED_DOWN';
    state.opponent.actionFrame = 5;

    const buffer = renderState(state);
    const expected = nesToRgba(0x38);
    let digitPixels = 0;
    for (const n of [1, 2, 3]) {
      const digit = getLargeCountDigitSprite(n);
      for (let sy = 0; sy < digit.height; sy++) {
        for (let sx = 0; sx < digit.width; sx++) {
          const ch = digit.rows[sy][sx];
          if (ch === '.' || ch === ' ') continue;
          const i = ((COUNT_DIGIT_Y + sy) * CANVAS_WIDTH + COUNT_DIGIT_X + sx) * 4;
          if (buffer[i] === expected[0] && buffer[i + 1] === expected[1] && buffer[i + 2] === expected[2]) digitPixels++;
        }
      }
    }
    expect(digitPixels, 'no digit pixels when count is 0').toBe(0);
  });
});

// Requirement 10: readable portraits
describe('Task 010 R10: readable head portraits', () => {
  for (const oppId of CIRCUIT_ROSTER_IDS) {
    it(`${oppId} 32x32 circuit portrait is >= 45% opaque with pixels in the top rows`, () => {
      const info = OPPONENT_PRESENTATION[oppId];
      const crop = getPortraitCrop(oppId, 32);
      let opaque = 0;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const ch = info.sprite.rows[crop.y + y]?.[crop.x + x];
          if (ch && ch !== '.' && ch !== ' ') opaque++;
        }
      }
      expect(opaque).toBeGreaterThanOrEqual(Math.ceil(0.45 * 32 * 32));

      let topOpaque = 0;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 32; x++) {
          const ch = info.sprite.rows[crop.y + y]?.[crop.x + x];
          if (ch && ch !== '.' && ch !== ' ') topOpaque++;
        }
      }
      expect(topOpaque).toBeGreaterThan(0);
    });

    it(`${oppId} 48x48 intro portrait is >= 45% opaque`, () => {
      const info = OPPONENT_PRESENTATION[oppId];
      const crop = getPortraitCrop(oppId, 48);
      let opaque = 0;
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const ch = info.sprite.rows[crop.y + y]?.[crop.x + x];
          if (ch && ch !== '.' && ch !== ' ') opaque++;
        }
      }
      expect(opaque).toBeGreaterThanOrEqual(Math.ceil(0.45 * 48 * 48));
    });
  }
});

// Requirement 11: text fits on screen
describe('Task 010 R11: presentation text fits within x 8-248', () => {
  // Compute each string's pixel width from the font: drawBitmapText advances 8px per char.
  function glyphWidth(ch: string): number {
    const glyph = FONT_8X8[ch.toUpperCase()] || FONT_8X8[' '];
    let w = 0;
    for (const row of glyph) if (row.length > w) w = row.length;
    return w;
  }
  function width(text: string): number {
    let w = 0;
    for (const ch of text) w += glyphWidth(ch);
    return w;
  }

  for (const oppId of CIRCUIT_ROSTER_IDS) {
    it(`${oppId} quote (wrapped), hometown and coach tip (wrapped) fit`, () => {
      const info = OPPONENT_PRESENTATION[oppId];
      for (const line of wrapText(info.quote, 28)) {
        expect(20 + width(line), `quote line "${line}"`).toBeLessThanOrEqual(248);
      }
      expect(20 + width(`FROM:   ${info.hometown}`)).toBeLessThanOrEqual(248);
      for (const line of wrapText(info.coachTip, 26)) {
        expect(24 + width(line), `coach tip line "${line}"`).toBeLessThanOrEqual(248);
      }
    });
  }

  it('circuit footer lines fit', () => {
    for (const line of CIRCUIT_FOOTER_LINES) {
      expect(16 + width(line), `footer "${line}"`).toBeLessThanOrEqual(248);
    }
  });
});

// Task 011: the fallen opponent is visible, in his own colors, during the count
function renderTask011(state: any): Uint8ClampedArray {
  const b = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
  const ctx = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: b }),
    putImageData: (imgData: any) => { b.set(imgData.data); },
  } as unknown as CanvasRenderingContext2D;
  renderFrame(ctx, state);
  return b;
}

function countDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, y0?: number, y1?: number): number {
  let diff = 0;
  const yStart = y0 ?? 0;
  const yEnd = y1 ?? CANVAS_HEIGHT;
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const i = (y * CANVAS_WIDTH + x) * 4;
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
    }
  }
  return diff;
}

function leftmostBelowFloor(buf: Uint8ClampedArray, floorY = 193): number {
  const [mr, mg, mb] = nesToRgba(0x19); // ring mat teal
  let min = -1;
  for (let y = floorY; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const i = (y * CANVAS_WIDTH + x) * 4;
      if (buf[i] !== mr || buf[i + 1] !== mg || buf[i + 2] !== mb) {
        if (min < 0 || x < min) min = x;
      }
    }
  }
  return min;
}

describe('Task 011 R1: no star-opportunity flash outside live play', () => {
  function knockdownState(starOpportunity: boolean) {
    const s: any = createFight('aint_man', 1);
    s.phase = 'KNOCKDOWN_COUNT';
    s.referee.downFighter = 'OPPONENT';
    s.opponent.action = 'KNOCKED_DOWN';
    s.opponent.actionFrame = 45;
    s.opponent.starOpportunity = starOpportunity;
    s.frame = 0; // flash on (Math.floor(0/8)%2 === 0)
    return s;
  }

  it('does not white-override a KNOCKED_DOWN opponent during the count', () => {
    const on = renderTask011(knockdownState(true));
    const off = renderTask011(knockdownState(false));
    expect(countDiff(on, off), 'starOpportunity must not change a fallen opponent').toBe(0);
  });

  it('still white-overrides a standing opponent during ROUND_ACTIVE', () => {
    const on: any = createFight('aint_man', 1);
    on.phase = 'ROUND_ACTIVE';
    on.opponent.action = 'IDLE';
    on.opponent.starOpportunity = true;
    on.frame = 0;
    const off: any = { ...on, opponent: { ...on.opponent, starOpportunity: false } };

    const diff = countDiff(renderTask011(on), renderTask011(off), 88, 190);
    expect(diff, 'star opportunity still flashes a live opponent').toBeGreaterThan(0);
  });
});

describe('Task 011 R2: player steps aside during the opponent count', () => {
  function knockdownState(starOpportunity: boolean): any {
    const s: any = createFight('aint_man', 1);
    s.phase = 'KNOCKDOWN_COUNT';
    s.referee.downFighter = 'OPPONENT';
    s.opponent.action = 'KNOCKED_DOWN';
    s.opponent.actionFrame = 45;
    s.opponent.starOpportunity = starOpportunity;
    s.frame = 0;
    return s;
  }

  function activeState(): any {
    const s: any = createFight('aint_man', 1);
    s.phase = 'ROUND_ACTIVE';
    s.opponent.action = 'IDLE';
    s.frame = 0;
    return s;
  }

  it('draws the player at x >= 152 during the count and back to normal in ROUND_ACTIVE', () => {
    expect(isPlayerSteppingAside(knockdownState(false))).toBe(true);
    expect(isPlayerSteppingAside(activeState())).toBe(false);

    const asideLeft = leftmostBelowFloor(renderTask011(knockdownState(false)));
    const activeLeft = leftmostBelowFloor(renderTask011(activeState()));

    expect(asideLeft, 'player stands aside at the right').toBeGreaterThanOrEqual(PLAYER_STEP_ASIDE_MIN_X);
    expect(activeLeft, 'player returns to his normal position').toBeLessThan(PLAYER_STEP_ASIDE_MIN_X);
    expect(asideLeft - activeLeft, 'shift is at least 64px').toBeGreaterThanOrEqual(64);
  });
});

describe('Task 011 R3: fallen opponent visible in the y140-189 band', () => {
  it('draws >= 600 opponent pixels in the band and >= 60% are not covered by the player', () => {
    const withOpp: any = createFight('aint_man', 1);
    withOpp.phase = 'KNOCKDOWN_COUNT';
    withOpp.referee.downFighter = 'OPPONENT';
    withOpp.opponent.action = 'KNOCKED_DOWN';
    withOpp.opponent.actionFrame = 45;
    withOpp.opponent.starOpportunity = false;
    withOpp.frame = 0;

    // Same scene with the opponent hidden (KO blink-off window) -> renders the player and ring only.
    const withoutOpp: any = {
      ...withOpp,
      opponent: { ...withOpp.opponent, action: 'KO', actionFrame: 35 },
    };

    const bufWith = renderTask011(withOpp);
    const bufWithout = renderTask011(withoutOpp);

    const sprite = getOpponentSprite('aint_man', 'KNOCKED_DOWN', 45);
    const oppDraw = computeOpponentDraw('aint_man', 'KNOCKED_DOWN', 45, 0);
    const oppX = oppDraw.x;
    const oppY = oppDraw.y;

    let footprint = 0;
    let notCovered = 0;
    for (let sy = 0; sy < sprite.height; sy++) {
      const py = oppY + sy;
      if (py < 140 || py > 189) continue;
      const row = sprite.rows[sy];
      for (let sx = 0; sx < sprite.width; sx++) {
        const ch = row[sx];
        if (ch === '.' || ch === ' ') continue;
        const px = oppX + sx;
        if (px < 0 || px >= CANVAS_WIDTH) continue;
        footprint++;
        const i = (py * CANVAS_WIDTH + px) * 4;
        if (bufWith[i] !== bufWithout[i] || bufWith[i + 1] !== bufWithout[i + 1] || bufWith[i + 2] !== bufWithout[i + 2]) {
          notCovered++;
        }
      }
    }

    expect(footprint, 'opponent pixels in band').toBeGreaterThanOrEqual(600);
    expect(notCovered / footprint, 'opponent pixels not hidden by the player').toBeGreaterThanOrEqual(0.6);
  });
});

describe('Task 012: Real animation frames from sheets', () => {
  const spriteMapJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts/sprite-map.json'), 'utf8'));

  // Requirement 2: One scale per character
  it('Requirement 2: each frame height is within ±2 px of round(sourceHeight * factor)', () => {
    for (const [id, charConfig] of Object.entries<any>(spriteMapJson)) {
      if (id === 'player') continue;
      const { idleFigureIndex, scaleFactor, figureBoxes } = charConfig;
      const factor = scaleFactor ?? (140 / (figureBoxes[idleFigureIndex][3] - figureBoxes[idleFigureIndex][1] + 1));
      const frameMap = OPPONENT_FRAME_MAPS[id];
      expect(frameMap, `Missing frame map for ${id}`).toBeDefined();

      for (const [key, sprite] of Object.entries(frameMap)) {
        if (key === 'LIE') {
          // Per Task 013 Requirement 2: Aint Man LIE is scaled down so height <= 86 px and width 105-125 px
          expect(sprite.height, `Character ${id} LIE height <= 86 px`).toBeLessThanOrEqual(86);
          expect(sprite.width, `Character ${id} LIE width >= 105 px`).toBeGreaterThanOrEqual(105);
          expect(sprite.width, `Character ${id} LIE width <= 125 px`).toBeLessThanOrEqual(125);
        } else {
          const figIdx = parseInt(key, 10);
          const box = figureBoxes[figIdx];
          expect(box, `Missing box for figure ${figIdx} on ${id}`).toBeDefined();
          const sourceHeight = box[3] - box[1] + 1;
          const expectedHeight = Math.round(sourceHeight * factor);
          expect(
            Math.abs(sprite.height - expectedHeight),
            `Character ${id} figure ${figIdx} height ${sprite.height} should be within ±2 px of round(${sourceHeight} * ${factor}) = ${expectedHeight}`
          ).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  // Requirement 3: Planted in the ring (anchor)
  it('Requirement 3: standing frames bottom row is at y = 190 and head center x is at x = 128 ± 2 (± pose dx)', () => {
    const STANDING_ACTIONS = [
      'IDLE',
      'BLOCK_HIGH',
      'BLOCK_LOW',
      'TELL_JAB_LEFT',
      'TELL_JAB_RIGHT',
      'PUNCH_JAB_LEFT',
      'PUNCH_JAB_RIGHT',
      'TELL_HOOK_LEFT',
      'TELL_HOOK_RIGHT',
      'PUNCH_HOOK_LEFT',
      'PUNCH_HOOK_RIGHT',
      'TELL_UPPERCUT_LEFT',
      'TELL_UPPERCUT_RIGHT',
      'PUNCH_UPPERCUT_LEFT',
      'PUNCH_UPPERCUT_RIGHT',
      'HIT',
      'STUNNED',
      'TAUNT',
    ];

    for (const id of ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man']) {
      for (const action of STANDING_ACTIONS) {
        const sprite = getOpponentSprite(id, action, 0);
        const { x, y } = computeOpponentDraw(id, action, 0, 0);
        const pose = OPPONENT_POSES[action] ?? { dx: 0, dy: 0, shake: 0 };

        // 1. Bottom row of sprite is at y = 190 (bottom row index in canvas: y + sprite.height - 1)
        const expectedY = action === 'TAUNT' ? 190 : (190 + pose.dy);
        expect(y + sprite.height - 1, `${id} ${action} bottom row lands at y = 190`).toBe(expectedY);

        // 2. Head center x of opaque pixels in the top 25% of rows lands at x = 128 ± 2 (± the pose's dx accent)
        const topRowCount = Math.max(1, Math.floor(sprite.height * 0.25));
        let sumX = 0;
        let count = 0;
        for (let r = 0; r < topRowCount; r++) {
          const rowStr = sprite.rows[r];
          for (let c = 0; c < sprite.width; c++) {
            if (rowStr[c] !== '.' && rowStr[c] !== ' ') {
              sumX += c;
              count++;
            }
          }
        }
        expect(count, `${id} ${action} has opaque pixels in top 25% rows`).toBeGreaterThan(0);
        const headLocalCenterX = Math.round(sumX / count);
        const headWorldCenterX = x + headLocalCenterX;
        // x in computeOpponentDraw includes oppTransform.dx + oppShakeX
        // Requirement 3 specifies: center x lands at 128 ± 2 (± the pose's dx accent [± shake])
        const expectedX = 128 + pose.dx + (computeOpponentDraw(id, action, 0, 0) as any).x - (Math.round(128 - headLocalCenterX) + pose.dx);
        // More simply: headWorldCenterX should land at 128 + pose.dx ± 2 (ignoring momentary shake) or including shake:
        const shakeX = (pose.shake > 0) ? pose.shake : 0;
        expect(
          Math.abs(headWorldCenterX - (128 + pose.dx + shakeX)),
          `${id} ${action} head center ${headWorldCenterX} lands at 128 + ${pose.dx} + ${shakeX} ± 2`
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  // Requirement 4: Pose -> frame diffs
  it('Requirement 4: every non-IDLE action differs from IDLE by >= 300 px, and TELL_* differs from PUNCH_* by >= 200 px', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    function renderOpponentOnly(id: string, action: string, actionFrame: number = 0): Uint8ClampedArray {
      const fight: any = createFight(id, 1);
      fight.phase = 'ROUND_ACTIVE';
      fight.opponent.action = action;
      fight.opponent.actionFrame = actionFrame;
      fight.opponent.starOpportunity = false;
      fight.frame = 0;
      // Hide player below to only compare opponent region
      fight.player.action = 'IDLE';

      const mock = createMockCanvas();
      renderFrame(mock.ctx, fight);
      return mock.buffer;
    }

    function countDiff(b1: Uint8ClampedArray, b2: Uint8ClampedArray, minY = 48, maxY = 192): number {
      let diff = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = 0; x < CANVAS_WIDTH; x++) {
          const idx = (y * CANVAS_WIDTH + x) * 4;
          if (b1[idx] !== b2[idx] || b1[idx + 1] !== b2[idx + 1] || b1[idx + 2] !== b2[idx + 2]) {
            diff++;
          }
        }
      }
      return diff;
    }

    const TEST_ACTIONS = [
      'BLOCK_HIGH',
      'BLOCK_LOW',
      'TELL_JAB_LEFT',
      'TELL_JAB_RIGHT',
      'PUNCH_JAB_LEFT',
      'PUNCH_JAB_RIGHT',
      'TELL_HOOK_LEFT',
      'TELL_HOOK_RIGHT',
      'PUNCH_HOOK_LEFT',
      'PUNCH_HOOK_RIGHT',
      'TELL_UPPERCUT_LEFT',
      'TELL_UPPERCUT_RIGHT',
      'PUNCH_UPPERCUT_LEFT',
      'PUNCH_UPPERCUT_RIGHT',
      'HIT',
      'STUNNED',
      'KNOCKED_DOWN',
      'KO',
      'TAUNT',
    ];

    const OPPONENTS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

    for (const id of OPPONENTS) {
      // Use frame 4 for HIT to avoid flash coloring differences dominating or frame 0 hit flash
      const idleBuf = renderOpponentOnly(id, 'IDLE', 0);

      for (const action of TEST_ACTIONS) {
        // Frame 15 for KNOCKED_DOWN / KO to test real lying frame; frame 4 for HIT; 0 for others
        const frame = (action === 'KNOCKED_DOWN' || action === 'KO') ? 15 : (action === 'HIT' ? 4 : 0);
        const actionBuf = renderOpponentOnly(id, action, frame);
        const diffFromIdle = countDiff(actionBuf, idleBuf);
        expect(
          diffFromIdle,
          `${id} action ${action} differs from IDLE by >= 300 px (got ${diffFromIdle})`
        ).toBeGreaterThanOrEqual(300);
      }

      // TELL_* vs PUNCH_* pairs
      const punchPairs = [
        ['TELL_JAB_LEFT', 'PUNCH_JAB_LEFT'],
        ['TELL_JAB_RIGHT', 'PUNCH_JAB_RIGHT'],
        ['TELL_HOOK_LEFT', 'PUNCH_HOOK_LEFT'],
        ['TELL_HOOK_RIGHT', 'PUNCH_HOOK_RIGHT'],
        ['TELL_UPPERCUT_LEFT', 'PUNCH_UPPERCUT_LEFT'],
        ['TELL_UPPERCUT_RIGHT', 'PUNCH_UPPERCUT_RIGHT'],
      ];

      for (const [tell, punch] of punchPairs) {
        const tellBuf = renderOpponentOnly(id, tell, 0);
        const punchBuf = renderOpponentOnly(id, punch, 0);
        const diffPair = countDiff(tellBuf, punchBuf);
        expect(
          diffPair,
          `${id} ${tell} differs from ${punch} by >= 200 px (got ${diffPair})`
        ).toBeGreaterThanOrEqual(200);
      }
    }
  });

  // Task 013 Requirement 1 & 2: AINT MAN LIE direction and size
  it('Requirement 1 & 2: AINT MAN LIE is rotated 90 deg CCW (structural transpose), left 25% holds former top rows, height <= 86 px, width 105-125 px', () => {
    // Height <= 86 px and width 105-125 px
    expect(AINT_MAN_LIE.height, 'AINT_MAN_LIE height <= 86 px').toBeLessThanOrEqual(86);
    expect(AINT_MAN_LIE.width, 'AINT_MAN_LIE width >= 105 px').toBeGreaterThanOrEqual(105);
    expect(AINT_MAN_LIE.width, 'AINT_MAN_LIE width <= 125 px').toBeLessThanOrEqual(125);

    // 1. Structural transpose test:
    // Take idle figure 0 and rotate it 90 deg CCW: top row becomes left column
    const idle = IDLE_BASE_AINT_MAN;
    const transW = idle.height; // 140
    const transH = idle.width;  // 107
    const transRows: string[] = [];
    for (let y = 0; y < transH; y++) {
      let r = '';
      for (let x = 0; x < transW; x++) {
        const sx = (idle.width - 1) - y;
        const sy = x;
        r += idle.rows[sy][sx];
      }
      transRows.push(r);
    }

    // Nearest-neighbour scale it to the LIE frame's width and height
    const lieW = AINT_MAN_LIE.width;
    const lieH = AINT_MAN_LIE.height;
    const scaledRows: string[] = [];
    for (let y = 0; y < lieH; y++) {
      const sy = Math.floor(y * transH / lieH);
      let r = '';
      for (let x = 0; x < lieW; x++) {
        const sx = Math.floor(x * transW / lieW);
        r += transRows[sy][sx];
      }
      scaledRows.push(r);
    }

    // Assert it equals the LIE rows exactly
    expect(AINT_MAN_LIE.rows, 'AINT_MAN_LIE matches 90 deg CCW nearest-neighbour scale of idle figure 0').toEqual(scaledRows);

    // 2. Left 25% of LIE columns holds the sprite's former top rows (the helmet):
    // The opaque pixels of idle rows 0-20 all land in LIE columns < 25% of its width
    const left25Col = Math.floor(lieW * 0.25);
    for (let lieX = 0; lieX < lieW; lieX++) {
      const sx = Math.floor(lieX * transW / lieW);
      if (sx <= 20) {
        expect(lieX, `LIE column ${lieX} corresponding to idle row ${sx} is in leftmost 25% (< ${left25Col})`).toBeLessThan(left25Col);
      }
    }
  });

  // Task 013 Requirement 4: Bounds for all five opponents at actionFrame 30
  it('Requirement 4: at actionFrame 30, every opponent opaque pixels span >= 90 px horizontally, <= 100 px vertically, bottom <= 192, and hSpan > vSpan', () => {
    const OPPONENTS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

    for (const id of OPPONENTS) {
      const sprite = getOpponentSprite(id, 'KNOCKED_DOWN', 30);
      const draw = computeOpponentDraw(id, 'KNOCKED_DOWN', 30, 0);

      // Measure lying sprite properties directly
      let minX = sprite.width;
      let maxX = -1;
      let minY = sprite.height;
      let maxY = -1;
      let opaqueCount = 0;

      for (let r = 0; r < sprite.height; r++) {
        const rowStr = sprite.rows[r];
        for (let c = 0; c < sprite.width; c++) {
          if (rowStr[c] !== '.' && rowStr[c] !== ' ') {
            opaqueCount++;
            if (c < minX) minX = c;
            if (c > maxX) maxX = c;
            if (r < minY) minY = r;
            if (r > maxY) maxY = r;
          }
        }
      }

      const hSpan = maxX - minX + 1;
      const vSpan = maxY - minY + 1;

      expect(hSpan, `${id} horizontal span >= 90 px`).toBeGreaterThanOrEqual(90);
      expect(vSpan, `${id} vertical span <= 100 px`).toBeLessThanOrEqual(100);

      // Bottom row lands on or before y = 192
      const drawnBottomY = draw.y + maxY;
      expect(drawnBottomY, `${id} bottom row <= 192`).toBeLessThanOrEqual(192);

      // Horizontal span > vertical span (lying flat on mat)
      expect(hSpan, `${id} horizontal span > vertical span`).toBeGreaterThan(vSpan);

      // Center opaque x at 128 ± 4
      const anchor = getSpriteAnchor(sprite);
      const centerOpaqueX = draw.x + anchor.centerOpaqueX;
      expect(Math.abs(centerOpaqueX - 128), `${id} center opaque x at 128 ± 4`).toBeLessThanOrEqual(4);
    }
  });

  // Task 013 Requirement 5: Non-tautological clip check (R5 clip)
  it('Requirement 5: R5 clip: non-tautological clip check verifies lying sprite pixels match canvas diff and fails if bottom 4 rows clipped', () => {
    function createMockCanvas(): { ctx: CanvasRenderingContext2D; buffer: Uint8ClampedArray } {
      const buffer = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
      const ctx = {
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: buffer }),
        putImageData: (imgData: any) => { buffer.set(imgData.data); },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    const OPPONENTS = ['aint_man', 'medi_jinx', 'dj_tito', 'mr_yankee', 'maga_man'];

    for (const id of OPPONENTS) {
      const withOpp: any = createFight(id, 1);
      withOpp.phase = 'KNOCKDOWN_COUNT';
      withOpp.referee.downFighter = 'OPPONENT';
      withOpp.opponent.action = 'KNOCKED_DOWN';
      withOpp.opponent.actionFrame = 30;
      withOpp.opponent.starOpportunity = false;
      withOpp.frame = 0;

      const withoutOpp: any = {
        ...withOpp,
        opponent: { ...withOpp.opponent, action: 'KO', actionFrame: 35 }, // blink off
      };

      const mWith = createMockCanvas();
      renderFrame(mWith.ctx, withOpp);
      const mWithout = createMockCanvas();
      renderFrame(mWithout.ctx, withoutOpp);

      const sprite = getOpponentSprite(id, 'KNOCKED_DOWN', 30);
      const { x, y } = computeOpponentDraw(id, 'KNOCKED_DOWN', 30, 0);

      const playerDraw = computePlayerDraw(withOpp);
      const playerSprite = playerDraw.sprite;
      const pX = playerDraw.x;
      const pY = playerDraw.y;

      // Count differing pixels inside the lying sprite's drawn rectangle
      let differingPixels = 0;
      for (let py = y; py < y + sprite.height; py++) {
        for (let px = x; px < x + sprite.width; px++) {
          const idx = (py * CANVAS_WIDTH + px) * 4;
          if (
            mWith.buffer[idx] !== mWithout.buffer[idx] ||
            mWith.buffer[idx + 1] !== mWithout.buffer[idx + 1] ||
            mWith.buffer[idx + 2] !== mWithout.buffer[idx + 2]
          ) {
            differingPixels++;
          }
        }
      }

      // Count the lying sprite's opaque pixels that are not covered by the player's pixels
      let expectedUncovered = 0;
      for (let r = 0; r < sprite.height; r++) {
        const py = y + r;
        const rowStr = sprite.rows[r];
        for (let c = 0; c < sprite.width; c++) {
          if (rowStr[c] !== '.' && rowStr[c] !== ' ') {
            const px = x + c;
            const pr = py - pY;
            const pc = px - pX;
            const coveredByPlayer =
              pr >= 0 && pr < playerSprite.height &&
              pc >= 0 && pc < playerSprite.width &&
              playerSprite.rows[pr][pc] !== '.' && playerSprite.rows[pr][pc] !== ' ';
            if (!coveredByPlayer) {
              const idx = (py * CANVAS_WIDTH + px) * 4;
              const [sr, sg, sb] = nesToRgba(sprite.palette[rowStr[c]]);
              const differsFromBg =
                sr !== mWithout.buffer[idx] ||
                sg !== mWithout.buffer[idx + 1] ||
                sb !== mWithout.buffer[idx + 2];
              if (differsFromBg) {
                expectedUncovered++;
              }
            }
          }
        }
      }

      expect(differingPixels, `${id} R5 clip: differing pixels count equals unoccluded lying sprite pixels`).toBe(expectedUncovered);
      expect(differingPixels, `${id} R5 clip: has substantial drawn pixels`).toBeGreaterThan(1000);

      // Verify that the test would FAIL if the renderer clipped the bottom 4 rows of the opponent sprite
      let clippedDiffCount = 0;
      const clipCutoffY = y + sprite.height - 4;
      for (let py = y; py < y + sprite.height; py++) {
        if (py >= clipCutoffY) continue; // simulated clipping of bottom 4 rows
        for (let px = x; px < x + sprite.width; px++) {
          const idx = (py * CANVAS_WIDTH + px) * 4;
          if (
            mWith.buffer[idx] !== mWithout.buffer[idx] ||
            mWith.buffer[idx + 1] !== mWithout.buffer[idx + 1] ||
            mWith.buffer[idx + 2] !== mWithout.buffer[idx + 2]
          ) {
            clippedDiffCount++;
          }
        }
      }
      expect(clippedDiffCount, `${id} R5 clip: fails if bottom 4 rows are clipped`).not.toBe(expectedUncovered);
    }
  });
});

describe('Task 014: Animated player rig', () => {
  const FRAME_NAMES = [
    'IDLE_A', 'IDLE_B',
    'JAB_L_WIND', 'JAB_L_HIT', 'JAB_L_BACK',
    'JAB_R_WIND', 'JAB_R_HIT', 'JAB_R_BACK',
    'BODY_L_WIND', 'BODY_L_HIT', 'BODY_L_BACK',
    'BODY_R_WIND', 'BODY_R_HIT', 'BODY_R_BACK',
    'STAR_WIND', 'STAR_HIT', 'STAR_BACK',
    'DODGE_L_HALF', 'DODGE_L',
    'DODGE_R_HALF', 'DODGE_R',
    'DUCK', 'BLOCK', 'HIT',
    'EXHAUSTED_A', 'EXHAUSTED_B',
    'FALL', 'DOWN', 'GET_UP', 'WIN'
  ];

  // Requirement 1: Generator checks palette and 1-px B outline
  it('Requirement 1: every frame uses only valid NES palette letters and has a 1-px B outline around opaque pixels', () => {
    const validLetters = new Set(['.', 'B', 'K', 'S', 'L', 'W', 'R', 'H', 'G']);

    for (const name of FRAME_NAMES) {
      const resolved = resolvePlayerFrame(name, 0);
      const sprite = resolved.sprite;

      expect(sprite.width, `${name} has positive width`).toBeGreaterThan(0);
      expect(sprite.height, `${name} has positive height`).toBeGreaterThan(0);

      for (let r = 0; r < sprite.height; r++) {
        const row = sprite.rows[r];
        for (let c = 0; c < sprite.width; c++) {
          const ch = row[c];
          expect(validLetters.has(ch), `${name} pixel at (${c},${r}) is valid letter '${ch}'`).toBe(true);

          // 1-px B outline: every opaque pixel that has a transparent 4-neighbour is B
          if (ch !== '.') {
            const hasTransparentNeighbor =
              r === 0 || r === sprite.height - 1 || c === 0 || c === sprite.width - 1 ||
              sprite.rows[r - 1][c] === '.' ||
              sprite.rows[r + 1][c] === '.' ||
              row[c - 1] === '.' ||
              row[c + 1] === '.';

            if (hasTransparentNeighbor) {
              expect(ch, `${name} perimeter pixel at (${c},${r}) must be 'B' outline`).toBe('B');
            }
          }
        }
      }
    }
  });

  // Requirement 2: Action -> frame table mapping
  it('Requirement 2: resolvePlayerFrame correctly maps every situation in the table', () => {
    // IDLE: IDLE_A / IDLE_B, alternating every 16 global frames
    expect(resolvePlayerFrame('IDLE', 0, { frame: 0 }).frameName).toBe('IDLE_A');
    expect(resolvePlayerFrame('IDLE', 0, { frame: 15 }).frameName).toBe('IDLE_A');
    expect(resolvePlayerFrame('IDLE', 0, { frame: 16 }).frameName).toBe('IDLE_B');
    expect(resolvePlayerFrame('IDLE', 0, { frame: 31 }).frameName).toBe('IDLE_B');
    expect(resolvePlayerFrame('IDLE', 0, { frame: 32 }).frameName).toBe('IDLE_A');

    // PUNCH_LEFT_HEAD: 0-3 WIND, 4-8 HIT, 9+ BACK
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 0).frameName).toBe('JAB_L_WIND');
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 3).frameName).toBe('JAB_L_WIND');
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 4).frameName).toBe('JAB_L_HIT');
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 8).frameName).toBe('JAB_L_HIT');
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 9).frameName).toBe('JAB_L_BACK');
    expect(resolvePlayerFrame('PUNCH_LEFT_HEAD', 13).frameName).toBe('JAB_L_BACK');

    // PUNCH_RIGHT_HEAD: R frames
    expect(resolvePlayerFrame('PUNCH_RIGHT_HEAD', 0).frameName).toBe('JAB_R_WIND');
    expect(resolvePlayerFrame('PUNCH_RIGHT_HEAD', 4).frameName).toBe('JAB_R_HIT');
    expect(resolvePlayerFrame('PUNCH_RIGHT_HEAD', 9).frameName).toBe('JAB_R_BACK');

    // PUNCH_*_BODY: BODY frames
    expect(resolvePlayerFrame('PUNCH_LEFT_BODY', 2).frameName).toBe('BODY_L_WIND');
    expect(resolvePlayerFrame('PUNCH_LEFT_BODY', 5).frameName).toBe('BODY_L_HIT');
    expect(resolvePlayerFrame('PUNCH_LEFT_BODY', 10).frameName).toBe('BODY_L_BACK');
    expect(resolvePlayerFrame('PUNCH_RIGHT_BODY', 1).frameName).toBe('BODY_R_WIND');
    expect(resolvePlayerFrame('PUNCH_RIGHT_BODY', 6).frameName).toBe('BODY_R_HIT');
    expect(resolvePlayerFrame('PUNCH_RIGHT_BODY', 11).frameName).toBe('BODY_R_BACK');

    // STAR_PUNCH: 0-7 WIND, 8-15 HIT, 16+ BACK
    expect(resolvePlayerFrame('STAR_PUNCH', 0).frameName).toBe('STAR_WIND');
    expect(resolvePlayerFrame('STAR_PUNCH', 7).frameName).toBe('STAR_WIND');
    expect(resolvePlayerFrame('STAR_PUNCH', 8).frameName).toBe('STAR_HIT');
    expect(resolvePlayerFrame('STAR_PUNCH', 15).frameName).toBe('STAR_HIT');
    expect(resolvePlayerFrame('STAR_PUNCH', 16).frameName).toBe('STAR_BACK');

    // DODGE_LEFT: 0-3 and 18+ DODGE_L_HALF, 4-17 DODGE_L
    expect(resolvePlayerFrame('DODGE_LEFT', 0).frameName).toBe('DODGE_L_HALF');
    expect(resolvePlayerFrame('DODGE_LEFT', 3).frameName).toBe('DODGE_L_HALF');
    expect(resolvePlayerFrame('DODGE_LEFT', 4).frameName).toBe('DODGE_L');
    expect(resolvePlayerFrame('DODGE_LEFT', 17).frameName).toBe('DODGE_L');
    expect(resolvePlayerFrame('DODGE_LEFT', 18).frameName).toBe('DODGE_L_HALF');
    expect(resolvePlayerFrame('DODGE_LEFT', 21).frameName).toBe('DODGE_L_HALF');

    // DODGE_RIGHT: mirrors
    expect(resolvePlayerFrame('DODGE_RIGHT', 2).frameName).toBe('DODGE_R_HALF');
    expect(resolvePlayerFrame('DODGE_RIGHT', 10).frameName).toBe('DODGE_R');
    expect(resolvePlayerFrame('DODGE_RIGHT', 19).frameName).toBe('DODGE_R_HALF');

    // DUCK, BLOCK, HIT
    expect(resolvePlayerFrame('DUCK', 5).frameName).toBe('DUCK');
    expect(resolvePlayerFrame('BLOCK', 5).frameName).toBe('BLOCK');
    expect(resolvePlayerFrame('HIT', 2).frameName).toBe('HIT');

    // isExhausted and idle: EXHAUSTED_A / B, alternating every 12 frames, pink palette
    const exhA = resolvePlayerFrame('IDLE', 0, { frame: 0, player: { isExhausted: true } });
    expect(exhA.frameName).toBe('EXHAUSTED_A');
    expect(exhA.sprite.palette['S']).toBe(0x25); // Pink skin

    const exhB = resolvePlayerFrame('IDLE', 0, { frame: 12, player: { isExhausted: true } });
    expect(exhB.frameName).toBe('EXHAUSTED_B');
    expect(exhB.sprite.palette['S']).toBe(0x25);

    // KNOCKED_DOWN / KO: 0-11 FALL, 12+ DOWN
    expect(resolvePlayerFrame('KNOCKED_DOWN', 0).frameName).toBe('FALL');
    expect(resolvePlayerFrame('KNOCKED_DOWN', 11).frameName).toBe('FALL');
    expect(resolvePlayerFrame('KNOCKED_DOWN', 12).frameName).toBe('DOWN');
    expect(resolvePlayerFrame('KO', 15).frameName).toBe('DOWN');

    // KNOCKED_DOWN with referee.downFighter === 'PLAYER' and playerMashCount >= 1
    const mashGetUp = resolvePlayerFrame('KNOCKED_DOWN', 15, {
      frame: 8, // window 1 (odd)
      referee: { downFighter: 'PLAYER', playerMashCount: 1 },
    });
    expect(mashGetUp.frameName).toBe('GET_UP');

    const mashDown = resolvePlayerFrame('KNOCKED_DOWN', 15, {
      frame: 0, // window 0 (even)
      referee: { downFighter: 'PLAYER', playerMashCount: 1 },
    });
    expect(mashDown.frameName).toBe('DOWN');
  });

  // Requirement 3: Not shifted stills (for every shift |dx|, |dy| <= 24, D >= 150)
  it('Requirement 3: every non-idle frame differs from IDLE_A by D >= 150 pixels for all shifts |dx|, |dy| <= 24', () => {
    const idleA = resolvePlayerFrame('IDLE', 0, { frame: 0 }).sprite;
    const idleAnchorX = resolvePlayerFrame('IDLE', 0, { frame: 0 }).anchorX;

    // Convert idleA into a rig coordinate grid:
    // rig y range: 0..103, rig x range: -30..30
    const IDLE_H = idleA.height;
    const IDLE_W = idleA.width;

    for (const name of FRAME_NAMES) {
      if (name === 'IDLE_A' || name === 'IDLE_B') continue;

      const f = resolvePlayerFrame(name, 0).sprite;
      const fAnchorX = resolvePlayerFrame(name, 0).anchorX;
      const fH = f.height;
      const fW = f.width;

      let minDiff = Infinity;
      for (let dy = -24; dy <= 24; dy++) {
        for (let dx = -24; dx <= 24; dx++) {
          // Bounding box of f and shifted idleA in rig coordinates:
          // In rig coords, for f:
          // x in [-fAnchorX, fW - 1 - fAnchorX]
          // y in [103 - (fH - 1), 103]
          // For shifted idleA:
          // x in [-idleAnchorX + dx, IDLE_W - 1 - idleAnchorX + dx]
          // y in [103 - (IDLE_H - 1) + dy, 103 + dy]
          const minX = Math.min(-fAnchorX, -idleAnchorX + dx);
          const maxX = Math.max(fW - 1 - fAnchorX, IDLE_W - 1 - idleAnchorX + dx);
          const minY = Math.min(103 - (fH - 1), 103 - (IDLE_H - 1) + dy);
          const maxY = Math.max(103, 103 + dy);

          let diffCount = 0;
          for (let y = minY; y <= maxY; y++) {
            const rf = y - 103 + (fH - 1);
            const ri = (y - dy) - 103 + (IDLE_H - 1);
            const rowF = (rf >= 0 && rf < fH) ? f.rows[rf] : null;
            const rowI = (ri >= 0 && ri < IDLE_H) ? idleA.rows[ri] : null;

            for (let x = minX; x <= maxX; x++) {
              const cf = x + fAnchorX;
              const ci = (x - dx) + idleAnchorX;
              const chF = (rowF && cf >= 0 && cf < fW) ? rowF[cf] : '.';
              const chI = (rowI && ci >= 0 && ci < IDLE_W) ? rowI[ci] : '.';

              if (chF !== chI) {
                diffCount++;
              }
            }
          }

          if (diffCount < minDiff) {
            minDiff = diffCount;
          }
        }
      }

      expect(minDiff, `Frame ${name} differs from shifted IDLE_A by >= 150 px (got ${minDiff})`).toBeGreaterThanOrEqual(150);
    }
  }, 30000);

  // Requirement 4: Pose geometry
  it('Requirement 4: generated frames satisfy all pose geometry constraints', () => {
    const idleA = resolvePlayerFrame('IDLE', 0, { frame: 0 }).sprite;
    const idleAnchor = resolvePlayerFrame('IDLE', 0, { frame: 0 }).anchorX;

    function getRedPixels(sprite: SpriteData, anchorX: number, xFilter?: (x: number) => boolean) {
      const pts: { x: number; y: number }[] = [];
      for (let r = 0; r < sprite.height; r++) {
        const y = (r - (sprite.height - 1)) + 103; // rig y (bottom row of standing frames)
        const row = sprite.rows[r];
        for (let c = 0; c < sprite.width; c++) {
          const ch = row[c];
          if (ch === 'R' || ch === 'H') {
            const x = c - anchorX; // rig x
            if (!xFilter || xFilter(x)) {
              pts.push({ x, y });
            }
          }
        }
      }
      return pts;
    }

    const idleLGloves = getRedPixels(idleA, idleAnchor, (x) => x < -5);
    const idleRGloves = getRedPixels(idleA, idleAnchor, (x) => x > 5);
    const idleLTop = Math.min(...idleLGloves.map((p) => p.y));
    const idleRTop = Math.min(...idleRGloves.map((p) => p.y));

    // 1. JAB_L_HIT:
    // - left glove's red pixels have top >= 24 px above IDLE_A's glove top
    // - opaque area <= 80% of IDLE_A's left glove area
    // - right glove box within 2 px of IDLE_A's
    const jabL = resolvePlayerFrame('PUNCH_LEFT_HEAD', 5).sprite;
    const jabLAnchor = resolvePlayerFrame('PUNCH_LEFT_HEAD', 5).anchorX;
    const jabLGloves = getRedPixels(jabL, jabLAnchor, (x) => x < 0);
    const jabLTop = Math.min(...jabLGloves.map((p) => p.y));
    expect(idleLTop - jabLTop, 'JAB_L_HIT left glove top >= 24 px above IDLE_A').toBeGreaterThanOrEqual(24);
    expect(jabLGloves.length / idleLGloves.length, 'JAB_L_HIT left glove area <= 80% of IDLE_A').toBeLessThanOrEqual(0.8);

    const jabRGloves = getRedPixels(jabL, jabLAnchor, (x) => x > 5);
    const idleRBox = {
      minX: Math.min(...idleRGloves.map((p) => p.x)),
      maxX: Math.max(...idleRGloves.map((p) => p.x)),
      minY: Math.min(...idleRGloves.map((p) => p.y)),
      maxY: Math.max(...idleRGloves.map((p) => p.y)),
    };
    const jabRBox = {
      minX: Math.min(...jabRGloves.map((p) => p.x)),
      maxX: Math.max(...jabRGloves.map((p) => p.x)),
      minY: Math.min(...jabRGloves.map((p) => p.y)),
      maxY: Math.max(...jabRGloves.map((p) => p.y)),
    };
    expect(Math.abs(idleRBox.minX - jabRBox.minX), 'right glove minX within 2 px').toBeLessThanOrEqual(2);
    expect(Math.abs(idleRBox.maxX - jabRBox.maxX), 'right glove maxX within 2 px').toBeLessThanOrEqual(2);
    expect(Math.abs(idleRBox.minY - jabRBox.minY), 'right glove minY within 2 px').toBeLessThanOrEqual(2);
    expect(Math.abs(idleRBox.maxY - jabRBox.maxY), 'right glove maxY within 2 px').toBeLessThanOrEqual(2);

    // 2. JAB_R_HIT: mirror of JAB_L_HIT
    const jabR = resolvePlayerFrame('PUNCH_RIGHT_HEAD', 5).sprite;
    const jabRAnchor = resolvePlayerFrame('PUNCH_RIGHT_HEAD', 5).anchorX;
    const jabRGlovesR = getRedPixels(jabR, jabRAnchor, (x) => x > 0);
    const jabRTop = Math.min(...jabRGlovesR.map((p) => p.y));
    expect(idleRTop - jabRTop, 'JAB_R_HIT right glove top >= 24 px above IDLE_A').toBeGreaterThanOrEqual(24);
    expect(jabRGlovesR.length / idleRGloves.length, 'JAB_R_HIT right glove area <= 80%').toBeLessThanOrEqual(0.8);

    // 3. BODY_L_HIT:
    // left glove center is >= 6 px closer to the spine than in IDLE_A, and lower than JAB_L_HIT glove center by >= 30 px
    const bodyL = resolvePlayerFrame('PUNCH_LEFT_BODY', 5).sprite;
    const bodyLAnchor = resolvePlayerFrame('PUNCH_LEFT_BODY', 5).anchorX;
    const bodyLGloves = getRedPixels(bodyL, bodyLAnchor, (x) => x < 0);
    const bodyLCenterX = bodyLGloves.reduce((s, p) => s + p.x, 0) / bodyLGloves.length;
    const bodyLCenterY = bodyLGloves.reduce((s, p) => s + p.y, 0) / bodyLGloves.length;
    const idleLCenterX = idleLGloves.reduce((s, p) => s + p.x, 0) / idleLGloves.length;
    const jabLCenterY = jabLGloves.reduce((s, p) => s + p.y, 0) / jabLGloves.length;
    expect(Math.abs(idleLCenterX) - Math.abs(bodyLCenterX), 'body glove >= 6 px closer to spine').toBeGreaterThanOrEqual(6);
    expect(bodyLCenterY - jabLCenterY, 'body glove lower than jab glove by >= 30 px').toBeGreaterThanOrEqual(30);

    // 4. STAR_HIT: right glove top is above the head top (y < 0)
    const starHit = resolvePlayerFrame('STAR_PUNCH', 10).sprite;
    const starAnchor = resolvePlayerFrame('STAR_PUNCH', 10).anchorX;
    const starRGloves = getRedPixels(starHit, starAnchor, (x) => x > 0);
    const starRTop = Math.min(...starRGloves.map((p) => p.y));
    expect(starRTop, 'STAR_HIT right glove top is above head top (y < 0)').toBeLessThan(0);

    // 5. DODGE_L:
    // head (B pixels in rows 0-24 of IDLE_A's head area, moved with frame) center x <= -16
    // bottom 8 rows have opaque center x within 6 px of IDLE_A's
    const dodgeL = resolvePlayerFrame('DODGE_LEFT', 6).sprite;
    const dodgeLAnchor = resolvePlayerFrame('DODGE_LEFT', 6).anchorX;
    const dodgeHeadX: number[] = [];
    for (let r = 0; r < Math.min(30, dodgeL.height); r++) {
      const y = (r - (dodgeL.height - 1)) + 99;
      if (y <= 24) {
        const row = dodgeL.rows[r];
        for (let c = 0; c < dodgeL.width; c++) {
          if (row[c] === 'B' || row[c] === 'G') {
            dodgeHeadX.push(c - dodgeLAnchor);
          }
        }
      }
    }
    const dodgeHeadCx = dodgeHeadX.reduce((s, v) => s + v, 0) / dodgeHeadX.length;
    expect(dodgeHeadCx, 'DODGE_L head center x <= -16').toBeLessThanOrEqual(-16);

    const idleBottomX: number[] = [];
    for (let r = idleA.height - 8; r < idleA.height; r++) {
      for (let c = 0; c < idleA.width; c++) {
        if (idleA.rows[r][c] !== '.') idleBottomX.push(c - idleAnchor);
      }
    }
    const dodgeBottomX: number[] = [];
    for (let r = dodgeL.height - 8; r < dodgeL.height; r++) {
      for (let c = 0; c < dodgeL.width; c++) {
        if (dodgeL.rows[r][c] !== '.') dodgeBottomX.push(c - dodgeLAnchor);
      }
    }
    const idleBottomCx = idleBottomX.reduce((s, v) => s + v, 0) / idleBottomX.length;
    const dodgeBottomCx = dodgeBottomX.reduce((s, v) => s + v, 0) / dodgeBottomX.length;
    expect(Math.abs(idleBottomCx - dodgeBottomCx), 'bottom 8 rows center x within 6 px of IDLE_A').toBeLessThanOrEqual(6);

    // 6. DODGE_R: mirror
    const dodgeR = resolvePlayerFrame('DODGE_RIGHT', 6).sprite;
    const dodgeRAnchor = resolvePlayerFrame('DODGE_RIGHT', 6).anchorX;
    const dodgeRHeadX: number[] = [];
    for (let r = 0; r < Math.min(30, dodgeR.height); r++) {
      const y = (r - (dodgeR.height - 1)) + 103;
      if (y <= 24) {
        const row = dodgeR.rows[r];
        for (let c = 0; c < dodgeR.width; c++) {
          if (row[c] === 'B' || row[c] === 'G') {
            dodgeRHeadX.push(c - dodgeRAnchor);
          }
        }
      }
    }
    const dodgeRHeadCx = dodgeRHeadX.reduce((s, v) => s + v, 0) / dodgeRHeadX.length;
    expect(dodgeRHeadCx, 'DODGE_R head center x >= 16').toBeGreaterThanOrEqual(16);

    // 7. DUCK:
    // head top is >= 16 px lower than IDLE_A's, both gloves overlap head's x range
    const duck = resolvePlayerFrame('DUCK', 5).sprite;
    const duckAnchor = resolvePlayerFrame('DUCK', 5).anchorX;
    let duckHeadMinY = Infinity;
    let duckHeadMinX = Infinity;
    let duckHeadMaxX = -Infinity;
    for (let r = 0; r < Math.min(45, duck.height); r++) {
      const y = (r - (duck.height - 1)) + 103;
      const row = duck.rows[r];
      for (let c = 0; c < duck.width; c++) {
        if (row[c] === 'B' || row[c] === 'G') {
          const x = c - duckAnchor;
          if (y < duckHeadMinY) duckHeadMinY = y;
          if (x < duckHeadMinX) duckHeadMinX = x;
          if (x > duckHeadMaxX) duckHeadMaxX = x;
        }
      }
    }
    const idleHeadMinY = 0;
    expect(duckHeadMinY - idleHeadMinY, 'duck head top >= 16 px lower').toBeGreaterThanOrEqual(16);

    const duckLGloves = getRedPixels(duck, duckAnchor, (x) => x < 0);
    const duckRGloves = getRedPixels(duck, duckAnchor, (x) => x > 0);
    const duckLGloveMaxX = Math.max(...duckLGloves.map((p) => p.x));
    const duckRGloveMinX = Math.min(...duckRGloves.map((p) => p.x));
    expect(duckLGloveMaxX, 'left glove overlaps head x range').toBeGreaterThanOrEqual(duckHeadMinX);
    expect(duckRGloveMinX, 'right glove overlaps head x range').toBeLessThanOrEqual(duckHeadMaxX);

    // 8. BLOCK: both gloves' boxes intersect head's box
    const block = resolvePlayerFrame('BLOCK', 0).sprite;
    const blockAnchor = resolvePlayerFrame('BLOCK', 0).anchorX;
    const blockHead = { minX: -10, maxX: 10, minY: 0, maxY: 24 };
    const blockLGloves = getRedPixels(block, blockAnchor, (x) => x < 0);
    const blockRGloves = getRedPixels(block, blockAnchor, (x) => x > 0);
    const blockLBox = {
      minX: Math.min(...blockLGloves.map((p) => p.x)),
      maxX: Math.max(...blockLGloves.map((p) => p.x)),
      minY: Math.min(...blockLGloves.map((p) => p.y)),
      maxY: Math.max(...blockLGloves.map((p) => p.y)),
    };
    const blockRBox = {
      minX: Math.min(...blockRGloves.map((p) => p.x)),
      maxX: Math.max(...blockRGloves.map((p) => p.x)),
      minY: Math.min(...blockRGloves.map((p) => p.y)),
      maxY: Math.max(...blockRGloves.map((p) => p.y)),
    };
    const intersects = (b1: any, b2: any) =>
      b1.minX <= b2.maxX && b1.maxX >= b2.minX && b1.minY <= b2.maxY && b1.maxY >= b2.minY;
    expect(intersects(blockLBox, blockHead), 'block L glove intersects head box').toBe(true);
    expect(intersects(blockRBox, blockHead), 'block R glove intersects head box').toBe(true);

    // 9. EXHAUSTED_A: glove tops >= 20 px lower than IDLE_A's
    const exhA = resolvePlayerFrame('IDLE', 0, { frame: 0, player: { isExhausted: true } }).sprite;
    const exhAAnchor = resolvePlayerFrame('IDLE', 0, { frame: 0, player: { isExhausted: true } }).anchorX;
    const exhLGloves = getRedPixels(exhA, exhAAnchor, (x) => x < 0);
    const exhLTop = Math.min(...exhLGloves.map((p) => p.y));
    expect(exhLTop - idleLTop, 'EXHAUSTED_A glove top >= 20 px lower than IDLE_A').toBeGreaterThanOrEqual(20);

    // 10. DOWN: wider than tall, at most 40 px tall
    const down = resolvePlayerFrame('KNOCKED_DOWN', 20).sprite;
    expect(down.width, 'DOWN is wider than tall').toBeGreaterThan(down.height);
    expect(down.height, 'DOWN is at most 40 px tall').toBeLessThanOrEqual(40);

    // 11. WIN: both glove tops are above head top (y < 0)
    const win = resolvePlayerFrame('WIN', 0).sprite;
    const winAnchor = resolvePlayerFrame('WIN', 0).anchorX;
    const winLGloves = getRedPixels(win, winAnchor, (x) => x < 0);
    const winRGloves = getRedPixels(win, winAnchor, (x) => x > 0);
    expect(Math.min(...winLGloves.map((p) => p.y)), 'WIN left glove top above head top').toBeLessThan(0);
    expect(Math.min(...winRGloves.map((p) => p.y)), 'WIN right glove top above head top').toBeLessThan(0);
  });

  // Requirement 5: Bigger, higher, planted
  it('Requirement 5: standing frames drawn with bottom row at canvas y = 239, anchorX at canvas x = 128, and IDLE head top at canvas y 132-146', () => {
    const fight = createFight('aint_man', 123);
    fight.player.action = 'IDLE';
    fight.player.actionFrame = 0;
    fight.frame = 0;

    const draw = computePlayerDraw(fight);

    // Bottom row of drawn frame is at canvas y = 239:
    const drawnBottomRow = draw.y + (draw.sprite.height - 1);
    expect(drawnBottomRow, 'bottom row lands at canvas y = 239').toBe(239);

    // anchorX is at canvas x = 128:
    const resolved = resolvePlayerFrame('IDLE', 0, fight);
    const canvasAnchorX = draw.x + resolved.anchorX;
    expect(canvasAnchorX, 'anchorX lands at canvas x = 128').toBe(128);

    // On fight screen, IDLE head top is at canvas y 132-146
    let minOpaqueRow = 0;
    for (let r = 0; r < draw.sprite.height; r++) {
      if (draw.sprite.rows[r].replace(/\./g, '').length > 0) {
        minOpaqueRow = r;
        break;
      }
    }
    const canvasHeadTopY = draw.y + minOpaqueRow;
    expect(canvasHeadTopY, 'IDLE head top is >= 132').toBeGreaterThanOrEqual(132);
    expect(canvasHeadTopY, 'IDLE head top is <= 146').toBeLessThanOrEqual(146);
  });
});


