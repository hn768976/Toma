import React, { useLayoutEffect, useMemo } from "react";
import { FRAME_H, FRAME_W } from "./grid";
import { activeGlitch, buildGlitchSchedule } from "./timing";
import type { Variant } from "./types";

/**
 * Thin horizontal slices of the finished frame shift sideways for two or three
 * frames at a time. The whole schedule is seeded and built once, so any frame
 * can be rendered independently and still agree with its neighbours.
 *
 * Runs after <MarkField> because sibling layout effects flush in render order.
 */
export const GlitchPass: React.FC<{
  variant: Variant;
  seed: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  frame: number;
  durationInFrames: number;
}> = ({ variant, seed, canvasRef, frame, durationInFrames }) => {
  const events = useMemo(
    () =>
      buildGlitchSchedule(seed, durationInFrames, FRAME_H, variant.glitch),
    [seed, durationInFrames, variant.glitch],
  );

  const scratch = useMemo(() => {
    if (!variant.glitch) return null;
    const c = document.createElement("canvas");
    c.width = FRAME_W;
    c.height = variant.glitch.maxSliceH + 4;
    return c;
  }, [variant.glitch]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scratch) return;
    const event = activeGlitch(events, frame);
    if (!event) return;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const sctx = scratch.getContext("2d") as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    for (const slice of event.slices) {
      const y = Math.max(0, Math.min(FRAME_H - slice.h, slice.y));
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.drawImage(canvas, 0, y, FRAME_W, slice.h, 0, 0, FRAME_W, slice.h);
      ctx.fillStyle = variant.palette.bg;
      ctx.fillRect(0, y, FRAME_W, slice.h);
      ctx.drawImage(
        scratch,
        0,
        0,
        FRAME_W,
        slice.h,
        slice.dx,
        y,
        FRAME_W,
        slice.h,
      );
    }
  });

  return null;
};
