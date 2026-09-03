import React, { useLayoutEffect } from "react";
import type { LayerBaseProps } from "./types";

/**
 * The near-black ground the whole overlay sits on, and the per-frame clear.
 *
 * This must be the first child of <GrungeOverlay>: its layout effect resets
 * the shared canvas before any other layer draws, which also makes the whole
 * pipeline idempotent if effects were ever to run twice for one frame.
 *
 * The base is deliberately very dark. In screen or add blend every dark region
 * of the frame becomes transparent over the editor's footage, so a muddy base
 * would show up as a grey haze across their shot.
 */
export const BaseFill: React.FC<
  Pick<LayerBaseProps, "canvasRef" | "width" | "height" | "mode" | "palette">
> = ({ canvasRef, width, height, mode, palette }) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);
    // In alpha mode there is no ground at all — the frame starts transparent
    // and only the light content ever gives it opacity.
    if (mode === "screen") {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, width, height);
    }
  });

  return null;
};
