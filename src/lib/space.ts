/**
 * Coordinate spaces used across the piece.
 *
 *  design  1920x1080 — the space every silhouette path is authored in.
 *  mask     960x540  — the rasterised silhouette / distance / span fields.
 *  canvas  3840x2160 — the real 4K backing store everything is drawn into.
 */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const CANVAS_W = 3840;
export const CANVAS_H = 2160;

export const MASK_W = 960;
export const MASK_H = 540;

/** design -> mask */
export const DESIGN_TO_MASK = MASK_W / DESIGN_W; // 0.5
/** mask -> canvas */
export const MASK_TO_CANVAS = CANVAS_W / MASK_W; // 4
/** design -> canvas */
export const DESIGN_TO_CANVAS = CANVAS_W / DESIGN_W; // 2

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 0..1 ramp. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Ease used for the assembly drift-in / dissolve-out. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
