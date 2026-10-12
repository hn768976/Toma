// Loop helpers. Every composition is a 600-frame seamless loop; all motion is
// computed from `frame % 600` so frame 600 is the same image as frame 0.

export const LOOP = 600;
export const FPS = 30;
export const TAU = Math.PI * 2;

export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;

// Phase in radians of a motion making `cycles` whole cycles per loop.
export const phase = (f: number, cycles = 1) => (TAU * cycles * loopFrame(f)) / LOOP;

// Index of the current hold step for a value that changes every `hold` frames.
// `hold` must divide 600 so the schedule wraps exactly.
export const holdIndex = (f: number, hold: number) => {
  if (LOOP % hold !== 0) throw new Error(`hold ${hold} must divide ${LOOP}`);
  return Math.floor(loopFrame(f) / hold);
};

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fract = (x: number) => x - Math.floor(x);
