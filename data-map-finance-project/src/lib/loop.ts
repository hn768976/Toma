// Loop helpers. A looping composition is 600 frames; every periodic motion uses
// a whole number of cycles over that length so frame 600 == frame 0.

export const TAU = Math.PI * 2;

/** Phase in [0,1) of a motion that completes `cycles` whole cycles per `loop` frames. */
export const phase = (frame: number, loop: number, cycles: number) => {
  const p = (frame * cycles) / loop;
  return p - Math.floor(p);
};

/** sin of a whole-cycle motion. */
export const wave = (frame: number, loop: number, cycles: number, offset = 0) =>
  Math.sin(TAU * ((frame * cycles) / loop + offset));

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const easeInOut = (t: number) => {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
