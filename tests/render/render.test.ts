import { describe, it, expect } from 'vitest';
import { NES_PALETTE, isNesColor } from '../../src/render/nesPalette';
import { OPPONENT_SPRITE_MAPS, getOpponentSprite, resolvePlayerSprite } from '../../src/render/poses';
import { getPlayerSprite } from '../../src/render/sprites/player';
import { REFEREE_SPRITES, getLargeCountDigitSprite } from '../../src/render/sprites/referee';
import { SpriteData } from '../../src/render/sprites/types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../src/render/renderFrame';
import { drawBitmapText } from '../../src/render/sprites/font';
import { createFight } from '../../src/core/engine';

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

  // Requirement 5: Readable tells
  describe('Readable tell frames (requirement 5)', () => {
    function computePixelDiff(s1: SpriteData, s2: SpriteData): number {
      let diff = 0;
      for (let y = 0; y < s1.height; y++) {
        for (let x = 0; x < s1.width; x++) {
          if (s1.rows[y][x] !== s2.rows[y][x]) diff++;
        }
      }
      return diff;
    }

    for (const oppId of OPPONENT_IDS) {
      it(`opponent ${oppId} tell frames differ from idle by >= 150 px and pairwise by >= 150 px`, () => {
        const spriteMap = OPPONENT_SPRITE_MAPS[oppId];
        const idle = spriteMap['IDLE_1'];
        const idle2 = spriteMap['IDLE_2'];
        expect(computePixelDiff(idle, idle2), 'idle breathing diff').toBeGreaterThanOrEqual(20);

        const tellJabL = spriteMap['TELL_JAB_LEFT'];
        const tellHookL = spriteMap['TELL_HOOK_LEFT'];
        const tellUpperL = spriteMap['TELL_UPPERCUT_LEFT'];

        // Diff against idle
        expect(computePixelDiff(tellJabL, idle), 'tell jab vs idle').toBeGreaterThanOrEqual(150);
        expect(computePixelDiff(tellHookL, idle), 'tell hook vs idle').toBeGreaterThanOrEqual(150);
        expect(computePixelDiff(tellUpperL, idle), 'tell uppercut vs idle').toBeGreaterThanOrEqual(150);

        // Pairwise diffs
        expect(computePixelDiff(tellJabL, tellHookL), 'tell jab vs tell hook').toBeGreaterThanOrEqual(150);
        expect(computePixelDiff(tellJabL, tellUpperL), 'tell jab vs tell uppercut').toBeGreaterThanOrEqual(150);
        expect(computePixelDiff(tellHookL, tellUpperL), 'tell hook vs tell uppercut').toBeGreaterThanOrEqual(150);
      });
    }
  });

  describe('Player Sprites (requirement 6)', () => {
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
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: buffer,
        }),
        putImageData: (imgData: any) => {
          buffer.set(imgData.data);
        },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, buffer };
    }

    it('M15: player sprite x shifts >= 24 px on dodge, y shifts >= 12 px on duck', () => {
      const idle = createFight('aint_man', 123);
      idle.player.action = 'IDLE';
      const dodgeL = createFight('aint_man', 123);
      dodgeL.player.action = 'DODGE_LEFT';
      const dodgeR = createFight('aint_man', 123);
      dodgeR.player.action = 'DODGE_RIGHT';
      const duck = createFight('aint_man', 123);
      duck.player.action = 'DUCK';

      const mockIdle = createMockCanvas();
      renderFrame(mockIdle.ctx, idle);

      const mockDodgeL = createMockCanvas();
      renderFrame(mockDodgeL.ctx, dodgeL);

      const mockDodgeR = createMockCanvas();
      renderFrame(mockDodgeR.ctx, dodgeR);

      const mockDuck = createMockCanvas();
      renderFrame(mockDuck.ctx, duck);

      // Compare against an empty ring canvas (or background) to find player sprite pixels
      const mockEmptyRing = createMockCanvas();
      const emptyFight = createFight('aint_man', 123);
      // Temporarily clear player action or use empty canvas
      emptyFight.player.action = 'KO';
      // When player is knocked down at y+22 vs active, we can compare directly against empty frame
      // Or compute player bounds by checking pixels that differ between idle and dodge
      function getPlayerPixelDiffBounds(buf1: Uint8ClampedArray, buf2: Uint8ClampedArray) {
        let minX = CANVAS_WIDTH, maxX = 0, minY = CANVAS_HEIGHT, maxY = 0;
        for (let y = 140; y < CANVAS_HEIGHT; y++) {
          for (let x = 0; x < CANVAS_WIDTH; x++) {
            const idx = (y * CANVAS_WIDTH + x) * 4;
            if (buf1[idx] !== buf2[idx] || buf1[idx+1] !== buf2[idx+1] || buf1[idx+2] !== buf2[idx+2]) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        return { minX, maxX, minY, maxY };
      }

      // We can directly find player center X from the player gloves (0x16: 181, 49, 32) or trunks (0, 0, 0)
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
      const f0 = createFight('aint_man', 123);
      f0.frame = 0;
      f0.opponent.action = 'IDLE';

      const f30 = createFight('aint_man', 123);
      f30.frame = 30;
      f30.opponent.action = 'IDLE';

      const mock0 = createMockCanvas();
      renderFrame(mock0.ctx, f0);

      const mock30 = createMockCanvas();
      renderFrame(mock30.ctx, f30);

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
