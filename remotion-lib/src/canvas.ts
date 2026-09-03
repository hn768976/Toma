/**
 * Core 2D-canvas helpers: a draw-once-per-render hook, offscreen surfaces,
 * colour conversion and the small maths used by every other module here.
 *
 * The model throughout this library is plain 2D canvas — no WebGL, no
 * Three.js. Each visual component owns one <canvas> layer and redraws it once
 * per React render, driven purely by useCurrentFrame(), so a render is a pure
 * function of the frame number and stays deterministic across workers.
 */
import { useLayoutEffect, useRef } from "react";

export type Draw2D = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/**
 * Returns a ref for a <canvas>. The draw callback runs once per React render,
 * before paint, on a context reset to a known-clean state. There is no
 * requestAnimationFrame anywhere — the frame number is the only clock.
 */
export const useCanvas2D = (draw: Draw2D) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    resetContext(ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, canvas.width, canvas.height);
  });
  return ref;
};

/** Puts a 2D context back into its default state. */
export const resetContext = (ctx: CanvasRenderingContext2D) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
};

/** Creates a detached canvas of the given size, already 2D-contexted. */
export const offscreen = (
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  return { canvas, ctx };
};

/** "#RRGGBB" (or "#RGB") -> {r, g, b}. */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

/** "#RRGGBB" + alpha -> a canvas-ready rgba() string. */
export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Mixes two hex colours and returns an rgba() string. */
export const mixRgba = (
  hexA: string,
  hexB: string,
  t: number,
  alpha: number,
): string => {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgba(${m(a.r, b.r)}, ${m(a.g, b.g)}, ${m(a.b, b.b)}, ${alpha})`;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

/** Fractional part, always in [0, 1). */
export const frac = (v: number) => v - Math.floor(v);

/** Turns a frame number into a phase in [0, 1) that closes over `period`. */
export const cyclePhase = (frame: number, period: number, offset = 0) =>
  frac(frame / period + offset);

export const TAU = Math.PI * 2;
