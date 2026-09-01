/**
 * ONE shared normalised timeline. Every animated element in the dashboard — the
 * line reveal, the bar growth, the counters, the donut sweep and the sparklines
 * — is derived from the single `progress` value computed here. That coupling is
 * what gives the piece direction; if each element ran its own clock the frame
 * would read as a busy loop instead of a single move.
 *
 * The ticker is the one deliberate exception: it scrolls at a constant rate for
 * the whole 300 frames, including the held head and tail.
 */

import { Easing, interpolate, random } from "remotion";
import { COUNTERS, SERIES_POINTS } from "./data";

export const DURATION_IN_FRAMES = 300;
export const FPS = 30;

/** Values sit at zero until here. */
export const CLIMB_START = 15;
/** Everything has arrived here; the rest is a hold. */
export const CLIMB_END = 260;

/** Design units the ticker travels per frame. */
export const TICKER_SPEED = 3.4;

const EASE = Easing.bezier(0.18, 0, 0.16, 1);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type Staircase = { times: number[]; fractions: number[] };

/**
 * A polling staircase: a counter that jumps at irregular moments by irregular
 * amounts and holds flat in between, the way a real counter reading from a
 * server does. Both the moments and the sizes are seeded, so the staircase is
 * identical on every render.
 */
const buildStaircase = (seed: string, steps: number): Staircase => {
  // Poll MOMENTS are spread across the linear clock, not the eased one: a
  // counter reading from a server polls at a roughly steady cadence however the
  // curve behind it is shaped.
  const times: number[] = [];
  for (let k = 0; k < steps; k++) {
    const base = (k + 1) / steps;
    const jitter = (random(`${seed}-t-${k}`) - 0.5) * (1.5 / steps);
    times.push(clamp01(base + jitter));
  }
  times.sort((a, b) => a - b);
  // Pull the first poll right up against the start so the counters are never
  // dead for long after the opening hold, and pin the last one to the end.
  times[0] = 0.02 + random(`${seed}-first`) * 0.03;
  times[steps - 1] = 1;

  // Poll VALUES follow the shared eased curve, so the counters accelerate and
  // settle in step with the lines even though they arrive in jumps.
  const fractions: number[] = [];
  let previous = 0;
  for (let k = 0; k < steps; k++) {
    const smooth = EASE(times[k]);
    // Deviate around the curve so some polls land a big jump and others barely
    // move, with a floor so an early poll never reports a flat zero, then clamp
    // monotonic — a counter never runs backwards.
    const noisy = Math.max(smooth * 0.6, smooth + (random(`${seed}-v-${k}`) - 0.42) * 0.11);
    previous = Math.max(previous, clamp01(noisy));
    fractions.push(previous);
  }
  fractions[steps - 1] = 1;
  return { times, fractions };
};

/** Latest step reached at `t`, held until the next one lands. */
const sampleStaircase = (stair: Staircase, t: number): number => {
  let value = 0;
  for (let k = 0; k < stair.times.length; k++) {
    if (t >= stair.times[k]) value = stair.fractions[k];
    else break;
  }
  return value;
};

const STAIRCASES: Record<string, Staircase> = Object.fromEntries(
  COUNTERS.map((c, i) => [c.key, buildStaircase(`counter-${c.key}`, 17 + i * 2)]),
);

export type CounterState = {
  key: string;
  /** 0..1 — how far this counter has climbed. */
  fraction: number;
  value: number;
};

export type DashboardAnimation = {
  frame: number;
  /** The shared eased 0..1 progress everything reads from. */
  progress: number;
  /** The same clock before easing — the counters' polling moments run off this. */
  linear: number;
  /** Fractional index of the line/bar reveal head, in series-point units. */
  revealIndex: number;
  /**
   * 0..1 lift out of the zeroed opening. Series values are multiplied by this,
   * so at frame 0 the three lines genuinely sit flat on the axis and rise into
   * shape as the sweep starts, rather than snapping to their first value.
   */
  valueLift: number;
  /** Per-bar growth, 0..1. */
  barGrowth: number[];
  counters: CounterState[];
  /** Donut sweep, 0..1. */
  donutSweep: number;
  /** Design units the ticker has scrolled left. */
  tickerOffset: number;
};

export const getAnimation = (frame: number): DashboardAnimation => {
  const linear = interpolate(frame, [CLIMB_START, CLIMB_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = EASE(linear);

  const revealIndex = progress * (SERIES_POINTS - 1);
  // Derived from the same progress — the lift is over by the time the head has
  // cleared the first couple of points, so no kink is ever visible.
  const valueLift = clamp01(progress * 12);

  const barGrowth = Array.from({ length: SERIES_POINTS }, (_, i) =>
    // Each column swells in just behind the sweeping line head.
    clamp01((revealIndex - i + 1.1) / 1.9),
  );

  const counters = COUNTERS.map((spec) => {
    const fraction = sampleStaircase(STAIRCASES[spec.key], linear);
    return { key: spec.key, fraction, value: spec.target * fraction };
  });

  return {
    frame,
    progress,
    linear,
    revealIndex,
    valueLift,
    barGrowth,
    counters,
    donutSweep: progress,
    tickerOffset: frame * TICKER_SPEED,
  };
};
