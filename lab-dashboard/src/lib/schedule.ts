import { interpolate } from "remotion";
import { DURATION_IN_FRAMES } from "../layout";
import { rnd, rndInt, rndRange } from "./rand";

/**
 * Everything that changes on a timer. All of it derives from `frame % 600`
 * and a stable seed, so no clock, no state and no accumulation is involved.
 */

/** Frames at which a value steps, with the gap between steps allowed to
 *  shrink across the piece (the "climbing" readouts speed up). */
export const buildSteps = (
  seed: string,
  gapAt: (t: number) => readonly [number, number],
): number[] => {
  const steps = [0];
  let f = 0;
  for (let i = 0; i < 400; i++) {
    const [lo, hi] = gapAt(f / DURATION_IN_FRAMES);
    f += Math.round(rndRange(`${seed}-gap${i}`, lo, hi));
    if (f >= DURATION_IN_FRAMES) break;
    steps.push(f);
  }
  return steps;
};

/** Index of the step in force at `frame`, plus how long ago it fired. */
export const stepAt = (
  steps: readonly number[],
  frame: number,
): { index: number; since: number } => {
  let index = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i] <= frame) {
      index = i;
      break;
    }
  }
  return { index, since: frame - steps[index] };
};

/**
 * Epoch-based reroll: a cell's value is a pure function of which epoch the
 * frame falls in. `period` must divide 600 so the sequence closes.
 */
export const epochAt = (frame: number, period: number, offset: number): number =>
  Math.floor(((frame + offset) % DURATION_IN_FRAMES) / period);

/** Periods that divide 600 evenly, used for every reroll and blink. */
export const LOOPING_PERIODS: readonly number[] = [50, 60, 75, 100, 120, 150, 200];

/** Linear 0 -> 1 instability across the piece, per the variant's ramp. */
export const instabilityAt = (
  frame: number,
  ramp: readonly [number, number],
): number =>
  interpolate(frame, [0, DURATION_IN_FRAMES], [ramp[0], ramp[1]], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export type AlertEvent = { start: number; length: number; target: number };

/** The escalating alert flashes: rarer at first, then every 20-30 frames. */
export const buildAlerts = (
  seed: string,
  from: number,
  gapStart: number,
  gapEnd: number,
): AlertEvent[] => {
  if (!Number.isFinite(from)) return [];
  const out: AlertEvent[] = [];
  let f = from;
  for (let i = 0; i < 200 && f < DURATION_IN_FRAMES; i++) {
    out.push({
      start: Math.round(f),
      length: rndInt(`${seed}-len${i}`, 4, 6),
      target: rndInt(`${seed}-tgt${i}`, 0, 2),
    });
    const t = interpolate(f, [from, DURATION_IN_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const gap = gapStart + (gapEnd - gapStart) * t;
    f += rndRange(`${seed}-ag${i}`, gap * 0.7, gap * 1.3);
  }
  return out;
};

/** The alert in force at `frame`, if any. */
export const activeAlert = (
  alerts: readonly AlertEvent[],
  frame: number,
): AlertEvent | null => {
  for (const a of alerts) {
    if (frame >= a.start && frame < a.start + a.length) return a;
  }
  return null;
};

export type GlitchSlice = { y: number; h: number; dx: number };

/**
 * Clustered horizontal tear. Bursts of 2-4 frames arrive irregularly from
 * `from`; inside a burst, 3-5 thin slices shift sideways by 30-120px.
 */
export const glitchAt = (
  seed: string,
  frame: number,
  from: number,
  height: number,
): GlitchSlice[] => {
  if (!Number.isFinite(from) || frame < from) return [];
  // Bursts are laid out on an irregular grid so they cluster rather than tick.
  const burst = Math.floor((frame - from) / 14);
  const jitter = rndInt(`${seed}-bj${burst}`, 0, 9);
  const start = from + burst * 14 + jitter;
  const len = rndInt(`${seed}-bl${burst}`, 2, 4);
  if (frame < start || frame >= start + len) return [];
  if (rnd(`${seed}-bo${burst}`) < 0.35) return [];

  const count = rndInt(`${seed}-bc${burst}`, 3, 5);
  const out: GlitchSlice[] = [];
  for (let i = 0; i < count; i++) {
    const k = `${seed}-${burst}-${frame - start}-${i}`;
    out.push({
      y: Math.round(rndRange(`${k}-y`, 0, height - 60)),
      h: rndInt(`${k}-h`, 14, 58),
      dx: Math.round(
        rndRange(`${k}-d`, 30, 120) * (rnd(`${k}-s`) < 0.5 ? -1 : 1),
      ),
    });
  }
  return out;
};
