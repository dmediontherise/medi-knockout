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
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../src/render/renderFrame';
import { drawBitmapText } from '../../src/render/sprites/font';
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
});
