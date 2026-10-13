import React, { useRef, useEffect, useState } from 'react';
import { FightState } from '../src/core/types';
import { GameState } from '../types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT } from '../src/render/renderFrame';
import { renderTitleScreen } from '../src/render/screens/title';
import { renderCircuitScreen } from '../src/render/screens/circuit';
import { renderIntroScreen } from '../src/render/screens/intro';
import { renderBetweenRoundsScreen } from '../src/render/screens/betweenRounds';
import { renderResultsScreen } from '../src/render/screens/results';

export type ScreenMode =
  | 'TITLE'
  | 'CIRCUIT'
  | 'INTRO'
  | 'BETWEEN_ROUNDS'
  | 'FIGHT'
  | 'RESULTS';

interface GameCanvasProps {
  state: FightState;
  screenMode: ScreenMode;
  circuitSelectedIndex?: number;
  unlockedIndex?: number;
  unlockAll?: boolean;
  frame?: number;
  className?: string;
  isPosePreview?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  state,
  screenMode,
  circuitSelectedIndex = 0,
  unlockedIndex = 0,
  unlockAll = false,
  frame = 0,
  className = '',
  isPosePreview = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const availW = container.clientWidth;
      const availH = container.clientHeight;

      const kX = Math.floor(availW / CANVAS_WIDTH);
      const kY = Math.floor(availH / CANVAS_HEIGHT);
      const k = Math.max(1, Math.min(kX, kY));
      setScaleFactor(k);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    if (isPosePreview) {
      renderFrame(ctx, state);
      return;
    }

    switch (screenMode) {
      case 'TITLE':
        renderTitleScreen(ctx, frame);
        break;
      case 'CIRCUIT':
        renderCircuitScreen(ctx, circuitSelectedIndex, unlockedIndex, unlockAll, frame);
        break;
      case 'INTRO':
        renderIntroScreen(ctx, state.opponentId, frame);
        break;
      case 'BETWEEN_ROUNDS':
        renderBetweenRoundsScreen(ctx, state, frame);
        break;
      case 'RESULTS':
        renderResultsScreen(ctx, state, frame);
        break;
      case 'FIGHT':
      default:
        renderFrame(ctx, state);
        break;
    }
  }, [state, screenMode, circuitSelectedIndex, unlockedIndex, unlockAll, frame, isPosePreview]);

  const cssWidth = CANVAS_WIDTH * scaleFactor;
  const cssHeight = CANVAS_HEIGHT * scaleFactor;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
        style={{
          imageRendering: 'pixelated',
          width: `${cssWidth}px`,
          height: `${cssHeight}px`,
          display: 'block',
          margin: '0 auto',
          backgroundColor: '#000000',
        }}
      />
    </div>
  );
};
