/**
 * trendingWalk.ts — a random walk that actually looks like a price chart.
 *
 * WHAT IT DOES
 *   Generates a seeded series that moves in RUNS: it picks a direction,
 *   commits to it for a random number of steps, then picks again, with an
 *   overall bias toward up or down.
 *
 * WHAT IT IS FOR
 *   Any chart that appears on screen as set dressing — trading terminals,
 *   dashboards, analytics hero shots, "number goes up" sequences.
 *
 * WHY NOT A PLAIN RANDOM WALK
 *   A pure `value += (rand - 0.5)` walk is memoryless, so it has no
 *   runs: every step is as likely to reverse as continue. Rendered as a
 *   line, that reads as flat fuzz — visually it is noise on a horizontal
 *   axis, with no rallies, no sell-offs, no shape the eye can name. Real
 *   series (and every chart an audience has seen) are dominated by
 *   momentum: sustained moves punctuated by reversals. Committing to a
 *   direction for a run of steps is the smallest change that produces
 *   that, and it is the difference between a chart that reads as data and
 *   one that reads as static.
 *
 * PARAMETERS
 *   length       how many points. Default 120.
 *   seed         integer; same seed => same series
 *   start        opening value. Default 100.
 *   bias         -1..1 toward down/up. Default 0.15 — a gentle uptrend,
 *                because most hero-shot charts want to end higher than
 *                they started. 0 is directionless; +1 never runs down.
 *   runLength    [min, max] steps to hold a direction. Default [4, 14].
 *                Short runs read as choppy/volatile, long runs as a
 *                trending market.
 *   volatility   step size as a fraction of `start`. Default 0.012.
 *   drift        per-step push in the run's direction, as a fraction of
 *                `start`. Default 0.004. This is what makes a run visibly
 *                a run rather than noise that happens to be correlated.
 *   min, max     optional clamps. When a value hits one, the current run
 *                is reversed rather than the series flat-lining along
 *                the bound (which looks broken).
 *
 * RETURNS
 *   number[] of length `length`.
 *
 * GOTCHA
 *   The series is unbounded by default and compounds, so a long series
 *   with a strong bias can wander far from `start`. Normalise before
 *   plotting (or set min/max) rather than assuming a range.
 *
 * USAGE
 *   const series = trendingWalk({ length: 180, seed: 9, bias: 0.2 });
 *   const d = seriesPath(series, { width: 1200, height: 400 });
 */

import { makeRng } from "../random/seededRandom";

export type TrendingWalkOptions = {
  seed: number;
  length?: number;
  start?: number;
  bias?: number;
  runLength?: [number, number];
  volatility?: number;
  drift?: number;
  min?: number;
  max?: number;
};

export const trendingWalk = ({
  seed,
  length = 120,
  start = 100,
  bias = 0.15,
  runLength = [4, 14],
  volatility = 0.012,
  drift = 0.004,
  min,
  max,
}: TrendingWalkOptions): number[] => {
  const rng = makeRng(seed);
  const series: number[] = [];
  const stepSize = start * volatility;
  const driftSize = start * drift;

  let value = start;
  let direction = rng() < (bias + 1) / 2 ? 1 : -1;
  let stepsLeft = 0;

  for (let i = 0; i < length; i++) {
    if (stepsLeft <= 0) {
      // New run. `bias` shifts the coin toward one direction; a bias of
      // 0.15 means roughly 57% of runs are up.
      direction = rng() < (bias + 1) / 2 ? 1 : -1;
      const [lo, hi] = runLength;
      stepsLeft = Math.max(1, Math.round(lo + rng() * Math.max(0, hi - lo)));
    }

    // Noise around a directional drift. The noise is symmetric, so runs
    // still contain down-ticks — which is what stops them looking ruled.
    value += direction * driftSize + (rng() - 0.5) * 2 * stepSize;

    if (min !== undefined && value < min) {
      value = min;
      direction = 1;
      stepsLeft = 0;
    }
    if (max !== undefined && value > max) {
      value = max;
      direction = -1;
      stepsLeft = 0;
    }

    series.push(value);
    stepsLeft--;
  }

  return series;
};

/**
 * Maps a series onto an SVG polyline, auto-scaling to the box. `padding`
 * keeps the extremes off the top and bottom edges.
 */
export const seriesPath = (
  series: readonly number[],
  {
    width,
    height,
    padding = 0.08,
  }: { width: number; height: number; padding?: number },
): string => {
  if (series.length === 0) return "";
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = hi - lo || 1;
  const pad = height * padding;
  const usable = height - pad * 2;

  const commands = series.map((value, i) => {
    const x = (i / Math.max(1, series.length - 1)) * width;
    // SVG y grows downward, so a high value must map to a small y.
    const y = pad + (1 - (value - lo) / span) * usable;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  });
  return commands.join(" ");
};
