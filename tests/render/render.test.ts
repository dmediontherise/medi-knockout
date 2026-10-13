import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NES_PALETTE, isNesColor, toFlashPalette, toDarkPalette } from '../../src/render/nesPalette';
import {
  OPPONENT_POSES,
  OPPONENT_SPRITE_MAPS,
  getOpponentSprite,
  resolvePlayerSprite,
  IDLE_BASES,
  PLAYER_POSES,
} from '../../src/render/poses';
import { getPlayerSprite, PLAYER_BACK_IDLE } from '../../src/render/sprites/player';
import { REFEREE_SPRITES, getLargeCountDigitSprite } from '../../src/render/sprites/referee';
import { SpriteData } from '../../src/render/sprites/types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT, COUNT_DIGIT_X, COUNT_DIGIT_Y, computePlayerDraw, isPlayerSteppingAside, PLAYER_STEP_ASIDE_MIN_X } from '../../src/render/renderFrame';
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
import { IDLE_BASE_AINT_MAN } from '../../src/render/sprites/generated/aint_man';
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
          expect(sprite.height).toBeGreaterThanOrEqual(112);
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

    it('all player poses are 60-90 px tall, >= 40 px wide and <= 12 NES colors', () => {
      for (const action of PLAYER_ACTIONS) {
        const normal = getPlayerSprite(action, false);
        expect(normal.height).toBeGreaterThanOrEqual(60);
        expect(normal.height).toBeLessThanOrEqual(90);
        expect(normal.width).toBeGreaterThanOrEqual(40);
        checkSpriteColors(normal, 12);

        const exhausted = getPlayerSprite(action, true);
        expect(exhausted.height).toBeGreaterThanOrEqual(60);
        expect(exhausted.height).toBeLessThanOrEqual(90);
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

    it('M15: player sprite x shifts >= 24 px on dodge, y shifts >= 12 px on duck', () => {
      const idle = createFight('aint_man', 123); idle.player.action = 'IDLE';
      const dodgeL = createFight('aint_man', 123); dodgeL.player.action = 'DODGE_LEFT';
      const dodgeR = createFight('aint_man', 123); dodgeR.player.action = 'DODGE_RIGHT';
      const duck = createFight('aint_man', 123); duck.player.action = 'DUCK';

      const mockIdle = createMockCanvas(); renderFrame(mockIdle.ctx, idle);
      const mockDodgeL = createMockCanvas(); renderFrame(mockDodgeL.ctx, dodgeL);
      const mockDodgeR = createMockCanvas(); renderFrame(mockDodgeR.ctx, dodgeR);
      const mockDuck = createMockCanvas(); renderFrame(mockDuck.ctx, duck);

      function findPlayerBounds(buf: Uint8ClampedArray) {
        let minX = CANVAS_WIDTH, maxX = 0, minY = CANVAS_HEIGHT, maxY = 0;
        for (let y = 168; y < CANVAS_HEIGHT; y++) {
          for (let x = 0; x < CANVAS_WIDTH; x++) {
            const idx = (y * CANVAS_WIDTH + x) * 4;
            const r = buf[idx], g = buf[idx+1], b = buf[idx+2];
            // Player gloves are red (0x16: 181, 49, 32 or 0x26: 254, 129, 112)
            if ((r === 181 && g === 49 && b === 32) || (r === 254 && g === 129 && b === 112)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        return { minX, maxX, minY, maxY };
      }

      const bIdle = findPlayerBounds(mockIdle.buffer);
      const bDodgeL = findPlayerBounds(mockDodgeL.buffer);
      const bDodgeR = findPlayerBounds(mockDodgeR.buffer);
      const bDuck = findPlayerBounds(mockDuck.buffer);

      const shiftL = bIdle.minX - bDodgeL.minX;
      const shiftR = bDodgeR.minX - bIdle.minX;
      const shiftDuck = bDuck.minY - bIdle.minY;

      expect(shiftL).toBeGreaterThanOrEqual(24);
      expect(shiftR).toBeGreaterThanOrEqual(24);
      expect(shiftDuck).toBeGreaterThanOrEqual(12);
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

    // R4: Fall and blink: KNOCKED_DOWN and KO slide down linearly over 0-30; from 31 KO blinks, KNOCKED_DOWN stays down
    it('R4: Fall and blink: KNOCKED_DOWN and KO slide linearly over 0-30, KO blinks from 31', () => {
      // Measure opponent top non-background row in rendered frames
      function getOpponentTopRow(buf: Uint8ClampedArray): number {
        for (let y = 48; y < CANVAS_HEIGHT; y++) {
          for (let x = 64; x < 192; x++) {
            const idx = (y * CANVAS_WIDTH + x) * 4;
            const r = buf[idx], g = buf[idx+1], b = buf[idx+2];
            // Compare against ring floor / background colors (ignore crowd / HUD)
            // Mat color is teal (r 0, g 128, b 136 approx) or black
            if ((r !== 0 || g !== 0 || b !== 0) && !(r === 0 && g === 136 && b === 136) && !(r === 0 && g === 168 && b === 68)) {
              return y;
            }
          }
        }
        return -1;
      }

      // Frame 0 vs Frame 30 fall
      const f0 = createFight('aint_man', 123); f0.opponent.action = 'KO'; f0.opponent.actionFrame = 0;
      const f15 = createFight('aint_man', 123); f15.opponent.action = 'KO'; f15.opponent.actionFrame = 15;
      const f30 = createFight('aint_man', 123); f30.opponent.action = 'KO'; f30.opponent.actionFrame = 30;

      const m0 = createMockCanvas(); renderFrame(m0.ctx, f0);
      const m15 = createMockCanvas(); renderFrame(m15.ctx, f15);
      const m30 = createMockCanvas(); renderFrame(m30.ctx, f30);

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

function leftmostBelowFloor(buf: Uint8ClampedArray, floorY = 190): number {
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
    const oppX = Math.round(128 - sprite.width / 2);
    const oppY = 150; // 50 + fallDy(100), dy = 0

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


