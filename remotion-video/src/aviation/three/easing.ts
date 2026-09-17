/**
 * Camera moves in the references are all shot on real rigs, so they never stop
 * dead or start instantly. These are the few curves the shots need, written as
 * pure functions of normalised time so a frame number is the only input.
 */

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Smoothstep's higher-order sibling: zero first *and* second derivative at both ends. */
export const smootherstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Constant-speed middle with eased ends — what a dolly on rails actually does. */
export const easeInOutSine = (t: number) => {
  const x = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
};

export const easeOutCubic = (t: number) => {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) ** 3;
};

export const easeInCubic = (t: number) => clamp(t, 0, 1) ** 3;

/** Maps a frame range onto 0..1, for staging beats inside a shot. */
export const range = (frame: number, from: number, to: number) =>
  clamp((frame - from) / (to - from), 0, 1);

/**
 * Sum of a few incommensurate sines. Used for handheld float and for the
 * low-frequency wallow of an aircraft in cruise — both read as organic
 * precisely because the periods never line up.
 */
export const drift = (t: number, seed: number) =>
  Math.sin(t * 0.7 + seed * 1.7) * 0.6 +
  Math.sin(t * 1.31 + seed * 4.1) * 0.28 +
  Math.sin(t * 2.17 + seed * 9.3) * 0.12;
