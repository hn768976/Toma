import { random } from "remotion";
import { PLOT_X0, PLOT_Y0, PLOT_Y1, PLOT_WIDTH } from "./layout";
import type { BarMode, Direction, Variant, VariantName } from "./variants";

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Rescales a walk so it always fills its band, whatever the seed produced. */
const normalise = (values: number[], lo: number, hi: number): number[] => {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  return values.map((v) => lo + ((v - min) / span) * (hi - lo));
};

/**
 * A climbing walk whose direction is biased over runs of 20-40 points, so the
 * line reads as a sequence of rallies and pullbacks rather than as noise.
 */
const buildClimbingWalk = (
  seed: string,
  count: number,
  volatility: number,
): number[] => {
  const out: number[] = [];
  let residual = 0;
  let runLeft = 0;
  let bias = 0;
  let run = 0;

  for (let k = 0; k < count; k++) {
    if (runLeft <= 0) {
      const s = `${seed}-run-${run}`;
      runLeft = 20 + Math.floor(random(`${s}-len`) * 21);
      // Runs lean upward roughly two times in three; the rest are pullbacks.
      const up = random(`${s}-dir`) < 0.63 ? 1 : -1;
      bias = up * (0.0030 + random(`${s}-amp`) * 0.0090) * volatility;
      run++;
    }
    const jitter = (random(`${seed}-j-${k}`) - 0.5) * 0.045 * volatility;
    // Pulled gently back toward the trend line so a run cannot run away.
    residual += bias + jitter - residual * 0.030;
    runLeft--;
    const base = 0.18 + 0.55 * (k / Math.max(1, count - 1));
    out.push(base + residual);
  }

  return normalise(out, 0.04, 0.96);
};

/**
 * A falling walk. Not a mirrored climb: drops are short and steep, the
 * recoveries after them are long, weak and always give back less than the
 * drop took, and one sharp capitulation lands about two thirds through.
 */
const buildFallingWalk = (
  seed: string,
  count: number,
  volatility: number,
): number[] => {
  const out: number[] = [];
  const capitulationAt = Math.floor(count * 0.66);
  let value = 0.95;
  let index = 0;
  let segment = 0;
  let lastDrop = 0.12;
  let capitulated = false;

  while (index < count) {
    const s = `${seed}-seg-${segment}`;
    let length: number;
    let total: number;

    if (!capitulated && index >= capitulationAt - 20) {
      length = 11;
      total = -(0.26 + random(`${s}-cap`) * 0.09);
      capitulated = true;
      lastDrop = -total;
    } else if (segment % 2 === 0) {
      length = 8 + Math.floor(random(`${s}-len`) * 9);
      total = -(0.07 + random(`${s}-amp`) * 0.10);
      lastDrop = -total;
    } else {
      length = 26 + Math.floor(random(`${s}-len`) * 20);
      // The recovery attempt only ever wins back part of what the preceding
      // drop took, so every rally is visible and every rally fails.
      total = lastDrop * (0.45 + random(`${s}-amp`) * 0.35);
    }

    const step = total / length;
    for (let i = 0; i < length && index < count; i++, index++) {
      const jitter = (random(`${seed}-j-${index}`) - 0.5) * 0.022 * volatility;
      value += step + jitter;
      out.push(value);
    }
    segment++;
  }

  return normalise(out, 0.05, 0.95);
};

export type Series = {
  color: string;
  /** 0..1 within the series' own band. */
  values: number[];
  /** Screen y per point, already placed inside the band. */
  ys: number[];
  /** Screen x per point. */
  xs: number[];
  /** 1 for the topmost series, falling away for the calmer ones below. */
  emphasis: number;
};

const walkFor = (direction: Direction) =>
  direction === "up" ? buildClimbingWalk : buildFallingWalk;

/**
 * One band per series. Bands only touch at their edges, so two series can
 * brush past each other but never share a region and tangle.
 */
export const buildSeries = (
  variantName: VariantName,
  variant: Variant,
  pointCount: number,
): Series[] => {
  const { seriesCount, palette, direction } = variant;
  const bandHeight = (PLOT_Y1 - PLOT_Y0) / seriesCount;
  const build = walkFor(direction);

  return Array.from({ length: seriesCount }, (_, i) => {
    // The topmost series is the most volatile; each one below it is calmer.
    const emphasis = Math.max(0.34, 1 - i * (0.62 / Math.max(1, seriesCount - 1)));
    const values = build(`${variantName}-series-${i}`, pointCount, emphasis);
    const centre = PLOT_Y0 + (i + 0.5) * bandHeight;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k < pointCount; k++) {
      xs.push(PLOT_X0 + (k / (pointCount - 1)) * PLOT_WIDTH);
      ys.push(centre - (values[k] - 0.5) * bandHeight * 0.84);
    }
    return { color: palette.series[i], values, ys, xs, emphasis };
  });
};

/** Linear sample of a series' 0..1 values at normalised position `u`. */
export const sampleAt = (values: number[], u: number): number => {
  const p = clamp(u, 0, 1) * (values.length - 1);
  const i = Math.floor(p);
  const j = Math.min(values.length - 1, i + 1);
  return values[i] + (values[j] - values[i]) * (p - i);
};

/**
 * Bar heights ride their own seeded noise but are pulled toward the primary
 * line, so the row relates to the chart above without echoing it.
 */
export const buildBars = (
  variantName: VariantName,
  count: number,
  mode: BarMode,
  primary: number[],
): number[] =>
  Array.from({ length: count }, (_, j) => {
    const u = (j + 0.5) / count;
    const own =
      0.6 * random(`${variantName}-bar-${j}`) +
      0.4 * random(`${variantName}-bar-${Math.max(0, j - 1)}`);
    let value = clamp(0.55 * sampleAt(primary, u) + 0.45 * own, 0.05, 1);
    if (mode === "descending") {
      // The last few are barely off the baseline.
      value = Math.max(0.025, value * (1 - 0.9 * Math.pow(u, 1.3)));
    }
    return value;
  });

export type Callout = {
  text: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  /** Only the brightest callouts are given bloom. */
  bright: boolean;
  /** Flipped to "right" near the frame edge so a label never runs off. */
  align: CanvasTextAlign;
};

/** Fixed-decimal formatting with grouped thousands, no locale involved. */
export const formatValue = (value: number, decimals: number): string => {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = value < 0 ? "-" : "";
  return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`;
};

export const formatSigned = (value: number, decimals: number): string =>
  `${value >= 0 ? "+" : "-"}${formatValue(Math.abs(value), decimals)}`;

/** Total number of callouts alive at any one moment. */
export const CALLOUT_COUNT = 14;
const CALLOUT_CYCLE = 96;

/** Interpolated leading point of a series at normalised progress `t`. */
export const leadingPoint = (series: Series, t: number) => {
  const p = clamp(t, 0, 1) * (series.xs.length - 1);
  const i = Math.floor(p);
  const j = Math.min(series.xs.length - 1, i + 1);
  const f = p - i;
  return {
    x: series.xs[i] + (series.xs[j] - series.xs[i]) * f,
    y: series.ys[i] + (series.ys[j] - series.ys[i]) * f,
    value: series.values[i] + (series.values[j] - series.values[i]) * f,
    index: p,
  };
};

/**
 * The callouts: one riding the leading point of every series, the rest
 * floating free over the map. Floating slots reroll their position, value and
 * opacity on their own stagger so the field keeps changing without ever
 * blinking over all at once.
 */
export const buildCallouts = (
  variantName: VariantName,
  series: Series[],
  frame: number,
  t: number,
  reveal: number,
): Callout[] => {
  const out: Callout[] = [];

  series.forEach((s, i) => {
    const point = leadingPoint(s, t);
    const previous = sampleAt(s.values, Math.max(0, t - 0.02));
    const level = 1000 + point.value * 3200;
    const delta = (point.value - previous) * 80;
    // Sits just above the leading point and tracks it, flipping to the far
    // side once the point nears the right edge.
    const flip = point.x > 3840 * 0.74;
    out.push({
      text: `${formatValue(level, 2)}  ${formatSigned(delta, 2)}%`,
      x: point.x + (flip ? -34 : 34),
      y: point.y - 40,
      size: 44,
      opacity: (0.62 + 0.32 * s.emphasis) * reveal,
      bright: i === 0,
      align: flip ? "right" : "left",
    });
  });

  const floating = CALLOUT_COUNT - series.length;
  for (let slot = 0; slot < floating; slot++) {
    const phase = slot * 11;
    const epoch = Math.floor((frame + phase) / CALLOUT_CYCLE);
    const local = ((frame + phase) % CALLOUT_CYCLE) / CALLOUT_CYCLE;
    const seed = `${variantName}-callout-${slot}-${epoch}`;

    // Fade in over the first tenth of the slot's life and out over the last.
    const fade =
      local < 0.1 ? local / 0.1 : local > 0.86 ? (1 - local) / 0.14 : 1;

    const base = 0.2 + random(`${seed}-a`) * 0.7;
    const drift = Math.sin(frame * 0.05 + slot) * 0.5 + 0.5;
    const magnitude = random(`${seed}-v`);
    const kind = random(`${seed}-k`);

    const text =
      kind < 0.42
        ? formatValue(120 + magnitude * 8600 + drift * 6, 2)
        : kind < 0.74
          ? `${formatSigned((magnitude - 0.45) * 9 + drift * 0.4, 2)}%`
          : formatValue(0.4 + magnitude * 6 + drift * 0.05, 3);

    out.push({
      text,
      x: 0.05 * 3840 + random(`${seed}-x`) * 0.8 * 3840,
      y: 0.09 * 2160 + random(`${seed}-y`) * 0.62 * 2160,
      size: 30 + random(`${seed}-s`) * 16,
      opacity: base * fade * reveal,
      bright: base > 0.74,
      align: "left",
    });
  }

  return out;
};
