import { random } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";

/**
 * Every value in the dashboard is a pure function of the frame number, and
 * every sequence is wrapped to DURATION_IN_FRAMES so frame 0 and frame 900 are
 * identical. Remotion's `random()` is the only entropy source - never
 * Math.random().
 */
export const LOOP = DURATION_IN_FRAMES;

/** Frame position inside the loop. */
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;

export const r = (seed: string) => random(seed);

export const rRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

export const rInt = (seed: string, minInclusive: number, maxExclusive: number) =>
  minInclusive + Math.floor(random(seed) * (maxExclusive - minInclusive));

export const rPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length) % items.length];

/** True with probability p. */
export const rChance = (seed: string, p: number) => random(seed) < p;

export type Cycle = {
  /** Which reroll this is, wrapped so the sequence repeats every 900 frames. */
  epoch: number;
  /** Progress 0..1 through the current reroll. */
  t: number;
  /** Frames elapsed since the current reroll started. */
  local: number;
};

/**
 * A reroll cycle of `period` frames, offset by `phase`. `period` must divide
 * 900; the epoch index is wrapped modulo 900/period so the value sequence -
 * not just the timing - repeats across the loop.
 */
export const cycle = (frame: number, period: number, phase = 0): Cycle => {
  const p = loopFrame(frame + phase);
  const epochs = LOOP / period;
  const raw = Math.floor(p / period);
  return {
    epoch: ((raw % epochs) + epochs) % epochs,
    t: (p % period) / period,
    local: p % period,
  };
};

/** Smoothstep. */
export const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Ramp up over `inFrames`, hold, ramp down over `outFrames`. */
export const envelope = (
  local: number,
  length: number,
  inFrames: number,
  outFrames: number,
) => {
  if (local < 0 || local > length) return 0;
  const rise = inFrames <= 0 ? 1 : smooth(local / inFrames);
  const fall = outFrames <= 0 ? 1 : smooth((length - local) / outFrames);
  return Math.min(rise, fall);
};
