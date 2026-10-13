import React, { useRef, useEffect } from 'react';
import { FightState } from '../src/core/types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT } from '../src/render/renderFrame';

interface GameCanvasProps {
  state: FightState;
  className?: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ state, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Crisp pixel rendering without anti-aliasing
    ctx.imageSmoothingEnabled = false;

    renderFrame(ctx, state);
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={`game-canvas ${className}`}
      style={{
        imageRendering: 'pixelated',
        width: '100%',
        maxWidth: '768px', // 3x scale of 256
        aspectRatio: '256 / 240',
        display: 'block',
        margin: '0 auto',
        backgroundColor: '#000000',
      }}
    />
  );
};
