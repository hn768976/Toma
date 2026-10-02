/** Shared timing constants. All looping looks are exactly LOOP frames long. */
export const FPS = 30;
export const LOOP = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const TAU = Math.PI * 2;

/** Normalised loop time t in [0,1). frame 600 → t = 0 again. */
export const loopT = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;

/** A sinusoid that completes exactly `cycles` (integer) cycles per loop. */
export const loopSin = (frame: number, cycles: number, phase = 0) =>
  Math.sin(TAU * cycles * loopT(frame) + phase);
export const loopCos = (frame: number, cycles: number, phase = 0) =>
  Math.cos(TAU * cycles * loopT(frame) + phase);

/** Fractional position of a sawtooth completing `cycles` whole cycles per loop. */
export const loopSaw = (frame: number, cycles: number, offset = 0) => {
  const v = loopT(frame) * cycles + offset;
  return v - Math.floor(v);
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
