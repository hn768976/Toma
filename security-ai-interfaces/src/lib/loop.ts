// Everything on screen is a pure function of the frame number.
// These helpers make the 600-frame loop structural: every periodic
// function below completes a whole number of cycles in LOOP frames, so
// frame 600 is identical to frame 0.

export const FPS = 30;
export const LOOP = 600; // 20 s
export const TAU = Math.PI * 2;

/** Frame wrapped into [0, LOOP). */
export const lf = (f: number) => ((f % LOOP) + LOOP) % LOOP;

/** Loop progress in [0, 1). */
export const t01 = (f: number) => lf(f) / LOOP;

const assertDivides = (period: number) => {
  if (LOOP % period !== 0) {
    throw new Error(`Period ${period} does not divide the ${LOOP}-frame loop`);
  }
};

/** Phase in [0, 1) of a cycle `period` frames long. `period` must divide LOOP. */
export const cyc = (f: number, period: number, offset = 0) => {
  assertDivides(period);
  return (((lf(f) + offset) % period) + period) % period / period;
};

/** Frame position inside a cycle `period` frames long. */
export const cycFrame = (f: number, period: number, offset = 0) =>
  cyc(f, period, offset) * period;

/** Integer index of the current cycle (0 .. LOOP/period - 1). */
export const cycIndex = (f: number, period: number, offset = 0) => {
  assertDivides(period);
  return Math.floor((((lf(f) + offset) % LOOP) + LOOP) % LOOP / period);
};

/** Sine with an integer number of cycles per loop, in [-1, 1]. */
export const wave = (f: number, cycles: number, phase = 0) => {
  if (!Number.isInteger(cycles)) throw new Error(`cycles must be an integer: ${cycles}`);
  return Math.sin(TAU * (cycles * t01(f) + phase));
};

/** wave() remapped to [0, 1]. */
export const wave01 = (f: number, cycles: number, phase = 0) => 0.5 + 0.5 * wave(f, cycles, phase);

/** Frame quantised to steps of n frames (n must divide LOOP). Keeps values periodic. */
export const stepF = (f: number, n: number) => {
  assertDivides(n);
  return Math.floor(lf(f) / n) * n;
};

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const fract = (x: number) => x - Math.floor(x);

/** Smooth bump: 0 outside [a, d], rises a..b, holds b..c, falls c..d. */
export const bump = (x: number, a: number, b: number, c: number, d: number) =>
  smooth(a, b, x) * (1 - smooth(c, d, x));

/** Soft blink: brightness in [0,1] for a light blinking every `period` frames. */
export const blink = (f: number, period: number, offset = 0, sharp = 3) => {
  const p = cyc(f, period, offset);
  return Math.pow(0.5 - 0.5 * Math.cos(TAU * p), sharp);
};
