import React, { useMemo } from "react";
import { WIDTH } from "../layout";
import type { FrameState } from "../lib/frame";
import { resetCtx } from "../lib/canvas";

const MAX_SLICE_H = 64;

/**
 * Thin horizontal slices of the finished frame shifted sideways for a few
 * frames at a time. Because it operates on the composited image, one tear
 * cuts across every panel it crosses — the whole console shears, not one
 * widget. Only the alert schedule ever produces slices.
 */
export const GlitchLayer: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, glitch } = state;

  const scratch = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = WIDTH;
    c.height = MAX_SLICE_H;
    return c;
  }, []);

  if (glitch.length === 0) return null;

  const sctx = scratch.getContext("2d") as CanvasRenderingContext2D;
  resetCtx(ctx);

  for (const s of glitch) {
    const h = Math.min(MAX_SLICE_H, s.h);
    // Copy out first: shifting a canvas onto itself in place is not safe.
    sctx.clearRect(0, 0, WIDTH, MAX_SLICE_H);
    sctx.drawImage(ctx.canvas, 0, s.y, WIDTH, h, 0, 0, WIDTH, h);
    ctx.clearRect(0, s.y, WIDTH, h);
    ctx.drawImage(scratch, 0, 0, WIDTH, h, s.dx, s.y, WIDTH, h);
  }

  return null;
};
