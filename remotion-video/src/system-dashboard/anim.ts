import { Easing, interpolate } from "remotion";
import { rand, randRange } from "./random";

/**
 * All motion in this composition is a pure function of the current frame.
 * Nothing here reads state or time, so Remotion can render frames out of
 * order across threads and still get identical output.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 ramp with an ease-out, clamped at both ends. */
export const appear = (frame: number, start: number, duration: number): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

/** Linear 0 -> 1 ramp, clamped. Used where an ease would look mechanical. */
export const ramp = (frame: number, start: number, duration: number): number =>
  interpolate(frame, [start, start + duration], [0, 1], clamp);

/**
 * Build-in start time for a module, staggered left to right across the
 * frame so nothing arrives at the same moment.
 */
export const staggerByX = (x: number, base: number, spread: number, width: number): number =>
  base + (x / width) * spread;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * A value that drifts to a new target every `hold` frames on a slow ease.
 * `phase` offsets the schedule so meters never move together.
 */
export const drift = (
  frame: number,
  seed: number,
  hold = 90,
  lo = 0.15,
  hi = 0.95,
  phase = 0,
): number => {
  const f = frame + phase;
  const idx = Math.floor(f / hold);
  const t = smoothstep((f - idx * hold) / hold);
  const a = randRange(seed * 7919 + idx, lo, hi);
  const b = randRange(seed * 7919 + idx + 1, lo, hi);
  return a + (b - a) * t;
};

/** True for `len` frames out of every `period`, offset by `phase`. */
export const blink = (frame: number, period: number, phase: number, len: number): boolean =>
  (((frame - phase) % period) + period) % period < len;

/**
 * Rare one- or two-frame dip in a module's opacity. At most one dip per
 * `window` frames and only in a bit under half of those windows, so the
 * flicker stays an event rather than a texture.
 */
export const flickerOpacity = (frame: number, seed: number, window = 170): number => {
  const win = Math.floor(frame / window);
  if (rand(seed * 104729 + win * 13) > 0.42) return 1;
  const at = win * window + Math.floor(rand(seed * 15485863 + win) * (window - 4));
  const len = 1 + Math.floor(rand(seed * 999983 + win) * 2);
  if (frame < at || frame >= at + len) return 1;
  return 0.18 + 0.28 * rand(seed + frame);
};

/**
 * A numeric readout whose digits tick independently. Each digit gets its
 * own period from the seed, so they never all change on the same frame.
 */
export const tickingDigits = (
  frame: number,
  seed: number,
  digits: number,
  minPeriod = 14,
  maxPeriod = 95,
): string => {
  let out = "";
  for (let i = 0; i < digits; i++) {
    const period = Math.floor(randRange(seed * 97 + i * 131, minPeriod, maxPeriod));
    const phase = Math.floor(rand(seed * 31 + i * 17) * period);
    const step = Math.floor((frame + phase) / period);
    out += Math.floor(rand(seed * 1259 + i * 7717 + step * 37) * 10);
  }
  return out;
};

const HEX = "0123456789ABCDEF";

/** Same idea as tickingDigits, in hex. */
export const tickingHex = (frame: number, seed: number, digits: number): string => {
  let out = "";
  for (let i = 0; i < digits; i++) {
    const period = Math.floor(randRange(seed * 61 + i * 211, 20, 120));
    const step = Math.floor((frame + i * 5) / period);
    out += HEX[Math.floor(rand(seed * 5081 + i * 3167 + step * 53) * 16)];
  }
  return out;
};
