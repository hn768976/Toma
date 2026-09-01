import React, { useLayoutEffect, useMemo, useRef } from "react";
import type { Ctx } from "../lib/draw";

/** Memoised offscreen canvas — used for bloom passes and cached chrome. */
export const useOffscreen = (
  w: number,
  h: number,
  deps: React.DependencyList = [],
): HTMLCanvasElement =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, ...deps]);

export type Bloom = { radius: number; alpha: number };

type Props = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** synchronous painter — called once per React render, no rAF anywhere */
  draw: (ctx: Ctx) => void;
  bloom?: Bloom;
  zIndex?: number;
};

/**
 * One positioned canvas. Backing store is sized in frame device pixels
 * (the composition is 3840x2160), so nothing is ever resampled.
 *
 * Drawing happens in a layout effect: synchronous, on every render, purely
 * from the props Remotion gives us for the current frame.
 */
export const Layer: React.FC<Props> = ({ x, y, w, h, draw, bloom, zIndex }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const glow = useOffscreen(bloom ? w : 1, bloom ? h : 1, [Boolean(bloom)]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, w, h);

    if (!bloom) {
      draw(ctx);
      return;
    }

    const gctx = glow.getContext("2d");
    if (!gctx) {
      draw(ctx);
      return;
    }
    gctx.clearRect(0, 0, w, h);
    draw(gctx);

    ctx.save();
    ctx.filter = `blur(${bloom.radius}px)`;
    ctx.globalAlpha = bloom.alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
    ctx.drawImage(glow, 0, 0);
  });

  return (
    <canvas
      ref={ref}
      width={Math.ceil(w)}
      height={Math.ceil(h)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: Math.ceil(w),
        height: Math.ceil(h),
        zIndex,
      }}
    />
  );
};
