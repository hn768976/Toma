/**
 * Tiny scalar helpers shared by every pass. Pure, allocation-free.
 */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 below `edge0`, 1 above `edge1`, Hermite in between. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Positive modulo — `frac(-0.25) === 0.75`. */
export const frac = (v: number): number => v - Math.floor(v);

export const TAU = Math.PI * 2;
