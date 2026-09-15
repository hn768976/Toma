/**
 * Deterministic PRNG. Every composition must render identically on every
 * machine and on every re-render, so nothing in this project may touch
 * Math.random().
 */
export const makeRandom = (seed: number) => {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
};

/** Uniform float in [min, max). */
export const range = (rnd: () => number, min: number, max: number) =>
  min + rnd() * (max - min);

/** Sign-symmetric float in [-amp, amp). */
export const spread = (rnd: () => number, amp: number) => range(rnd, -amp, amp);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v;

/** Hermite ease used for all entrances so nothing starts or stops abruptly. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number) => t * t * (3 - 2 * t);
