/**
 * A canvas host that redraws on every frame.
 *
 * The draw callback receives (ctx, frame, width, height) and must be a pure
 * function of those — this is the contract every library component is built to.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
) => void;

export const Canvas: React.FC<{ draw: DrawFn }> = ({ draw }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const run = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
    draw(ctx, frame, width, height);
  }, [draw, frame, width, height]);

  // Draw synchronously during commit so the frame is complete before Remotion
  // captures it.
  useEffect(run, [run]);

  return <canvas ref={ref} width={width} height={height} style={{ width, height }} />;
};
