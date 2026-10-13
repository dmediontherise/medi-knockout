import React, { useRef, useEffect, useState } from 'react';
import { FightState } from '../src/core/types';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT } from '../src/render/renderFrame';

interface GameCanvasProps {
  state: FightState;
  className?: string;
  isPosePreview?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ state, className = '', isPosePreview = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  // Compute integer scale factor k >= 1 based on container's available width and height
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

    // Crisp pixel rendering without anti-aliasing
    ctx.imageSmoothingEnabled = false;

    renderFrame(ctx, state);
  }, [state]);

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
