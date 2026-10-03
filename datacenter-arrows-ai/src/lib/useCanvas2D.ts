import { useMemo } from "react";
import { getRemotionEnvironment } from "remotion";

/**
 * Device-pixel ratio for 2D canvases: follows Remotion's --scale when
 * rendering, a cheap fixed ratio in the Studio.
 */
export const canvasDpr = (compWidth: number) =>
  getRemotionEnvironment().isRendering
    ? window.devicePixelRatio
    : Math.min(0.5, 1920 / compWidth);

/** Scratch canvases owned by one component instance. Cleared before use every frame. */
export const useScratchCanvases = (n: number) =>
  useMemo(() => Array.from({ length: n }, () => document.createElement("canvas")), [n]);

export const sizeCanvas = (c: HTMLCanvasElement, w: number, h: number) => {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: false })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.clearRect(0, 0, W, H);
  return ctx;
};
