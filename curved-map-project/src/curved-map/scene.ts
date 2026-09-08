/**
 * All generated scene content — chart series, their labels, the connection
 * arcs, the bar stacks and the edge UI texture. Everything is produced once at
 * module level from a seeded PRNG, so no frame depends on any other.
 */
import { FLAT_WIDTH, TIMING, VIDEO_HEIGHT, visibleY } from "./constants";
import { isLand } from "./land-mask";
import { lonToX, latToY } from "./projection";
import { mulberry32, pick, randInt, randRange, type Rng } from "./random";

/* ------------------------------------------------------------------ labels */

const FRAGMENT_LETTERS = "abcdefghijkmnopqrstuvwxyz";

/**
 * Deliberately non-lexical: lowercase letter runs and bare numbers. No
 * tickers, company names, timestamps or anything that could read as real
 * market data — at the size these are drawn they are texture, not content.
 */
const makeFragment = (rng: Rng): string => {
  const length = randInt(rng, 2, 4);
  let out = "";
  for (let i = 0; i < length; i++) out += pick(rng, FRAGMENT_LETTERS.split(""));
  return out;
};

const makeReadout = (rng: Rng): string => {
  const style = randInt(rng, 0, 3);
  if (style === 0) return randRange(rng, 0, 1).toFixed(4);
  if (style === 1) return randRange(rng, 10, 999).toFixed(1);
  if (style === 2) return `${rng() < 0.5 ? "+" : "-"}${randRange(rng, 0, 9).toFixed(2)}`;
  return `${makeFragment(rng)} ${randRange(rng, 0, 99).toFixed(1)}`;
};

/* ------------------------------------------------------------------ charts */

export type ChartLabel = {
  /** Index into the series at which this label sits. */
  readonly index: number;
  readonly text: string;
  readonly dy: number;
  readonly size: number;
  readonly alpha: number;
};

export type Chart = {
  readonly points: Float32Array; // x0, y0, x1, y1, ...
  readonly count: number;
  readonly lineWidth: number;
  readonly nodes: readonly number[]; // indices carrying a vertex dot
  readonly labels: readonly ChartLabel[];
  readonly start: number;
  readonly end: number;
};

type ChartSpec = {
  seed: number;
  x0: number;
  x1: number;
  baseline: number;
  amplitude: number;
  count: number;
  lineWidth: number;
  labelDensity: number;
  start: number;
  end: number;
};

/** A random walk with a few scripted spikes, normalised to +/-1. */
const makeSeries = (rng: Rng, count: number): Float32Array => {
  const values = new Float32Array(count);
  // Frames at which the series makes a sharp, out-of-character move.
  const spikes = new Set<number>();
  const spikeCount = randInt(rng, 3, 6);
  for (let i = 0; i < spikeCount; i++) {
    spikes.add(randInt(rng, Math.floor(count * 0.12), count - 4));
  }

  let value = 0;
  let momentum = 0;
  for (let i = 0; i < count; i++) {
    momentum = momentum * 0.72 + (rng() - 0.5) * 0.42;
    value += momentum;
    if (spikes.has(i)) value += (rng() < 0.5 ? -1 : 1) * randRange(rng, 1.6, 3.4);
    // Pull back toward the middle so the walk does not run off.
    value *= 0.965;
    values[i] = value;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-6, max - min);
  for (let i = 0; i < count; i++) values[i] = ((values[i] - min) / span) * 2 - 1;
  return values;
};

const buildChart = (spec: ChartSpec): Chart => {
  const rng = mulberry32(spec.seed);
  const series = makeSeries(rng, spec.count);
  const points = new Float32Array(spec.count * 2);
  for (let i = 0; i < spec.count; i++) {
    points[i * 2] = spec.x0 + ((spec.x1 - spec.x0) * i) / (spec.count - 1);
    points[i * 2 + 1] = spec.baseline - series[i] * spec.amplitude;
  }

  const nodes: number[] = [];
  const labels: ChartLabel[] = [];
  for (let i = 2; i < spec.count - 2; i++) {
    if (rng() < 0.09) nodes.push(i);
    if (rng() < spec.labelDensity) {
      labels.push({
        index: i,
        text: rng() < 0.55 ? makeReadout(rng) : makeFragment(rng),
        dy: rng() < 0.5 ? -randRange(rng, 26, 62) : randRange(rng, 34, 70),
        size: randRange(rng, 17, 27),
        alpha: randRange(rng, 0.22, 0.55),
      });
    }
  }

  return {
    points,
    count: spec.count,
    lineWidth: spec.lineWidth,
    nodes,
    labels,
    start: spec.start,
    end: spec.end,
  };
};

export const CHARTS: readonly Chart[] = [
  buildChart({
    seed: 0xc0ffee,
    x0: FLAT_WIDTH * 0.025,
    x1: FLAT_WIDTH * 0.945,
    baseline: visibleY(0.63),
    amplitude: VIDEO_HEIGHT * 0.145,
    count: 138,
    lineWidth: 4.2,
    labelDensity: 0.075,
    start: TIMING.charts[0].start,
    end: TIMING.charts[0].end,
  }),
  buildChart({
    seed: 0xbeef17,
    x0: FLAT_WIDTH * 0.285,
    x1: FLAT_WIDTH * 0.985,
    baseline: visibleY(0.235),
    amplitude: VIDEO_HEIGHT * 0.082,
    count: 96,
    lineWidth: 3.2,
    labelDensity: 0.06,
    start: TIMING.charts[1].start,
    end: TIMING.charts[1].end,
  }),
  buildChart({
    seed: 0x1a2b3c,
    x0: FLAT_WIDTH * 0.045,
    x1: FLAT_WIDTH * 0.335,
    baseline: visibleY(0.845),
    amplitude: VIDEO_HEIGHT * 0.055,
    count: 62,
    lineWidth: 2.6,
    labelDensity: 0.05,
    start: TIMING.charts[2].start,
    end: TIMING.charts[2].end,
  }),
];

/* -------------------------------------------------------------------- arcs */

export type Arc = {
  readonly ax: number;
  readonly ay: number;
  readonly cx: number;
  readonly cy: number;
  readonly bx: number;
  readonly by: number;
  readonly start: number;
  readonly end: number;
  /** Travelling-dot period in frames, and its phase offset. */
  readonly travelPeriod: number;
  readonly travelPhase: number;
  readonly width: number;
};

const ARC_COUNT = 7;

const buildArcs = (): Arc[] => {
  const rng = mulberry32(0xa2c5);
  const arcs: Arc[] = [];
  let guard = 0;
  while (arcs.length < ARC_COUNT && guard++ < 4000) {
    const lonA = randRange(rng, -170, 170);
    const latA = randRange(rng, -45, 62);
    const lonB = randRange(rng, -170, 170);
    const latB = randRange(rng, -45, 62);
    if (!isLand(lonA, latA) || !isLand(lonB, latB)) continue;

    const ax = lonToX(lonA);
    const ay = latToY(latA);
    const bx = lonToX(lonB);
    const by = latToY(latB);
    const span = Math.abs(bx - ax);
    if (span < FLAT_WIDTH * 0.16 || span > FLAT_WIDTH * 0.62) continue;
    if (arcs.some((a) => Math.hypot(a.ax - ax, a.ay - ay) < FLAT_WIDTH * 0.05))
      continue;

    // Control point above the midpoint: flatter than a semicircle.
    const lift = span * randRange(rng, 0.3, 0.44);
    const index = arcs.length;
    const stagger =
      TIMING.arcsStart +
      ((TIMING.arcsEnd - TIMING.arcsStart - 46) * index) / (ARC_COUNT - 1);

    arcs.push({
      ax,
      ay,
      bx,
      by,
      cx: (ax + bx) / 2 + randRange(rng, -60, 60),
      cy: (ay + by) / 2 - lift,
      start: Math.round(stagger),
      end: Math.round(stagger + randRange(rng, 38, 52)),
      travelPeriod: randRange(rng, 78, 132),
      travelPhase: rng(),
      width: randRange(rng, 1.9, 3.1),
    });
  }
  return arcs;
};

export const ARCS: readonly Arc[] = buildArcs();

/* -------------------------------------------------------------------- bars */

export type BarColumn = {
  readonly x: number;
  readonly width: number;
  readonly baseY: number;
  readonly segmentHeight: number;
  readonly gap: number;
  /** Segment count over time: pairs of [frame, count]. */
  readonly steps: readonly (readonly [number, number])[];
  readonly highlights: Uint8Array;
  readonly start: number;
  readonly end: number;
};

const BAR_COLUMNS = 9;

const buildBars = (): BarColumn[] => {
  const rng = mulberry32(0xba25);
  const columns: BarColumn[] = [];
  const areaX0 = FLAT_WIDTH * 0.7;
  const areaX1 = FLAT_WIDTH * 0.965;
  const slot = (areaX1 - areaX0) / BAR_COLUMNS;
  const baseY = visibleY(0.9);

  for (let i = 0; i < BAR_COLUMNS; i++) {
    const maxSegments = randInt(rng, 9, 24);
    const highlights = new Uint8Array(maxSegments + 8);
    for (let s = 0; s < highlights.length; s++) {
      highlights[s] = rng() < 0.16 ? 1 : 0;
    }

    // A handful of scripted height changes over the hold.
    const steps: [number, number][] = [[0, maxSegments]];
    let at = randInt(rng, 320, 360);
    while (at < 450) {
      steps.push([at, Math.max(5, maxSegments + randInt(rng, -5, 4))]);
      at += randInt(rng, 26, 58);
    }

    const start = TIMING.barsStart + Math.round((i * 9) / 1);
    columns.push({
      x: areaX0 + slot * i + slot * 0.16,
      width: slot * 0.62,
      baseY,
      segmentHeight: randRange(rng, 13, 18),
      gap: randRange(rng, 5, 8),
      steps,
      highlights,
      start,
      end: Math.min(TIMING.barsEnd, start + 44),
    });
  }
  return columns;
};

export const BARS: readonly BarColumn[] = buildBars();

/* -------------------------------------------------------------- UI texture */

export type TextureBlock = {
  readonly x: number;
  readonly y: number;
  readonly kind: "bars" | "ticks" | "strip";
  readonly width: number;
  readonly height: number;
  /** Per-element magnitudes for the bar and tick kinds. */
  readonly values: Float32Array;
  readonly text: string;
  readonly alpha: number;
};

/**
 * Faint blocks of interface texture along the top and bottom edges. Small bar
 * rows, tick rules and illegible label strips — texture, not content.
 */
const buildTexture = (): TextureBlock[] => {
  const rng = mulberry32(0x7e47a1);
  const blocks: TextureBlock[] = [];
  const bands = [visibleY(0.032), visibleY(0.935)];

  for (const bandY of bands) {
    let x = FLAT_WIDTH * 0.02;
    while (x < FLAT_WIDTH * 0.97) {
      const kind = pick(rng, ["bars", "ticks", "strip"] as const);
      const width =
        kind === "strip"
          ? randRange(rng, 90, 220)
          : randRange(rng, 130, 330);
      const height =
        kind === "bars" ? randRange(rng, 26, 54) : randRange(rng, 14, 26);

      const elementCount = kind === "strip" ? 0 : randInt(rng, 8, 26);
      const values = new Float32Array(elementCount);
      for (let i = 0; i < elementCount; i++) values[i] = 0.18 + rng() * 0.82;

      blocks.push({
        x,
        y: bandY,
        kind,
        width,
        height,
        values,
        text: kind === "strip" ? makeFragment(rng) + " " + makeReadout(rng) : "",
        alpha: randRange(rng, 0.14, 0.38),
      });

      x += width + randRange(rng, 40, 190);
    }
  }
  return blocks;
};

export const TEXTURE_BLOCKS: readonly TextureBlock[] = buildTexture();
