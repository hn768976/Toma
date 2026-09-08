import {useLayoutEffect, type RefObject} from "react";
import type {Stage} from "../lib/stage";

export type PassProps = {
  stage: Stage;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

/**
 * Each render pass is a component that draws into the shared stage from a
 * layout effect. React flushes sibling layout effects in tree order, so the
 * order the passes appear in <WaveMap> is the order they run in. Every pass is
 * written to be idempotent so a double-invoked effect redraws the same image.
 */
export const usePass = (
  {stage, canvasRef}: PassProps,
  draw: (ctx: CanvasRenderingContext2D, stage: Stage) => void,
) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    draw(ctx, stage);
    ctx.restore();
  });
};
