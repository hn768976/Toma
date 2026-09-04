import React, { useLayoutEffect, useRef } from 'react';
import { useVideoConfig } from 'remotion';

export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

type Props = {
  draw: DrawFn;
  /**
   * Backing-store resolution as a fraction of the composition size. Soft layers
   * (nebulae, glows, bloom) are drawn small and upscaled by the browser, which
   * costs nothing visually on smooth gradients and a great deal in render time.
   * Layers that need a hard edge — the starfield, the silhouette — use 1.
   */
  res?: number;
  blend?: React.CSSProperties['mixBlendMode'];
  opacity?: number;
  /** CSS filter, in composition pixels. Used for the bloom pass. */
  filter?: string;
};

/**
 * One canvas in the composite stack.
 *
 * The draw callback always works in *composition* coordinates (0..width,
 * 0..height) whatever `res` is set to, so every size in this project can be
 * written as a fraction of the frame and the 1080p preview matches a 4K render
 * exactly.
 *
 * Drawing happens in a layout effect rather than a passive one: layout effects
 * flush before paint, so the canvas is guaranteed to hold this frame's content
 * by the time Remotion screenshots the page.
 */
export const Layer: React.FC<Props> = ({ draw, res = 1, blend, opacity, filter }) => {
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  const bw = Math.max(1, Math.round(width * res));
  const bh = Math.max(1, Math.round(height * res));

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(bw / width, 0, 0, bh / height, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={ref}
      width={bw}
      height={bh}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        mixBlendMode: blend,
        opacity,
        filter,
      }}
    />
  );
};
