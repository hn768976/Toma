/**
 * Loop-safe animation helpers.
 *
 * Every value here is a pure function of the frame number and closes exactly
 * on LOOP frames, so frame 0 and frame LOOP are pixel identical and
 * `npx remotion render` is deterministic.
 */
import { random, spring } from "remotion";
import { FPS, LOOP } from "../constants";

/** frame folded into [0, LOOP) */
export const wrap = (frame: number, offset = 0): number =>
  (((frame + offset) % LOOP) + LOOP) % LOOP;

/** normalised loop position, 0 -> 1 */
export const loopT = (frame: number): number => wrap(frame) / LOOP;

/** `turns` whole revolutions per loop, in radians */
export const spin = (frame: number, turns: number): number =>
  loopT(frame) * Math.PI * 2 * turns;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const rnd = (seed: string): number => random(seed);

export const rndIn = (seed: string, lo: number, hi: number): number =>
  lo + random(seed) * (hi - lo);

/**
 * A value that springs to a fresh seeded target every `period` frames.
 * `period` must divide LOOP; the spring settles inside `settle` frames so the
 * value is flat at every cycle boundary, which is what makes the loop close.
 */
export const steppedSpring = (
  frame: number,
  seed: string,
  period: number,
  lo: number,
  hi: number,
  offset = 0,
  settle = 45,
): number => {
  const steps = LOOP / period;
  const f = wrap(frame, offset);
  const step = Math.floor(f / period);
  const local = f - step * period;
  const prev = rndIn(`${seed}:${(step - 1 + steps) % steps}`, lo, hi);
  const next = rndIn(`${seed}:${step}`, lo, hi);
  const t = spring({
    frame: local,
    fps: FPS,
    config: { damping: 14, mass: 0.9, stiffness: 90 },
    durationInFrames: settle,
  });
  return lerp(prev, next, t);
};

/** Same cadence as steppedSpring but stepping through a fixed list. */
export const steppedPick = <T,>(
  frame: number,
  period: number,
  items: readonly T[],
  offset = 0,
): T => {
  const f = wrap(frame, offset);
  return items[Math.floor(f / period) % items.length];
};

/**
 * A short seeded flash. Returns 0..1. `period` must divide LOOP and the flash
 * must be shorter than `period` so it never straddles the loop seam.
 */
export const flashAt = (
  frame: number,
  seed: string,
  slots: number,
  matches: (pick: number) => boolean,
  hold = 6,
): number => {
  const period = LOOP / slots;
  const f = wrap(frame);
  const slot = Math.floor(f / period);
  const local = f - slot * period;
  if (local >= hold) {
    return 0;
  }
  if (!matches(random(`${seed}:${slot}`))) {
    return 0;
  }
  return 1 - local / hold;
};

/**
 * A seeded, smoothly varying, exactly periodic series of `n` samples.
 * Sampling it with a wrapping index gives a signal that tiles at the seam.
 */
export const series = (seed: string, n: number, smooth = 2): number[] => {
  const raw = Array.from({ length: n }, (_, i) => random(`${seed}#${i}`));
  let out = raw;
  for (let pass = 0; pass < smooth; pass++) {
    const src = out;
    out = src.map((_, i) => {
      const a = src[(i - 1 + n) % n];
      const b = src[i];
      const c = src[(i + 1) % n];
      return (a + b * 2 + c) / 4;
    });
  }
  return out;
};

/** Sample a periodic series at a fractional index, wrapping and interpolating. */
export const sampleSeries = (data: number[], index: number): number => {
  const n = data.length;
  const i = ((index % n) + n) % n;
  const i0 = Math.floor(i);
  const i1 = (i0 + 1) % n;
  return lerp(data[i0], data[i1], i - i0);
};
