import { mulberry32, range, shuffled, type Rng } from "./random";

/**
 * The whole scene is generated from a seed, in units of *frame height*.
 * A radius of 0.2 means "0.2 x the height of the frame". Components multiply
 * by the real height from `useVideoConfig()`, so the design is resolution
 * independent and the 3840x2160 source renders identically at any scale.
 */

export type ColorKey = "block" | "arc" | "detail" | "accent" | "dim" | "dimWhite";

export type Dash = { a0: number; a1: number; r: number };

export type Segment = {
  angle: number;
  r: number;
  w: number;
  h: number;
  rx: number;
  filled: boolean;
  color: ColorKey;
};

export type Block = { angle: number; r: number; w: number; h: number; rx: number };

export type Arc = {
  r: number;
  a0: number;
  a1: number;
  width: number;
  /** Which of the three arc radii this belongs to; drives its spin rate. */
  group: 0 | 1 | 2;
  color: ColorKey;
  order: number;
};

export type Tick = { angle: number; r0: number; r1: number; width: number; color: ColorKey; order: number };

export type DataBlock = {
  angle: number;
  r: number;
  /** Tangential and radial size. */
  w: number;
  h: number;
  filled: boolean;
  /** Number of hatch lines drawn inside an outlined block. */
  hatch: number;
  width: number;
  color: ColorKey;
  order: number;
};

export type Radial = { angle: number; r0: number; r1: number; width: number; order: number };

export type CornerMark = {
  x: number;
  y: number;
  w: number;
  h: number;
  filled: boolean;
  width: number;
  color: ColorKey;
  order: number;
};

export type Layout = {
  dashes: Dash[];
  segments: Segment[];
  blocks: Block[];
  arcs: Arc[];
  ticks: Tick[];
  dataBlocks: DataBlock[];
  outerArcs: Arc[];
  radials: Radial[];
  cornerMarks: CornerMark[];
};

/** Radii of the concentric layers, inner to outer, as fractions of frame height. */
export const R = {
  dashed: 0.098,
  segments: 0.132,
  blockInner: 0.166,
  blockOuter: 0.208,
  arc: [0.224, 0.243, 0.272] as const,
  tickInner: 0.292,
  tickOuter: 0.308,
  outerFaint: 0.352,
  outerBroken: 0.386,
  radialInner: 0.318,
  radialOuter: 0.398,
  /** Nothing but corner marks is allowed outside this. */
  clear: 0.425,
};

const ARC_SPANS: readonly (readonly [number, number, number])[] = [
  // [group, a0, a1]
  [0, -8, 82],
  [0, 110, 152],
  [0, 188, 268],
  [0, 292, 332],
  [1, 20, 62],
  [1, 96, 186],
  [1, 212, 238],
  [1, 300, 352],
  [2, -20, 48],
  [2, 70, 98],
  [2, 130, 218],
  [2, 250, 286],
  [2, 318, 342],
];

const buildDashes = (): Dash[] => {
  const count = 96;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    a0: i * step,
    a1: i * step + step * 0.62,
    r: R.dashed,
  }));
};

const buildSegments = (rng: Rng): Segment[] => {
  const count = 34;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const roll = rng();
    return {
      angle: i * step,
      r: R.segments,
      w: 0.0155,
      h: 0.0205,
      rx: 0.005,
      filled: roll > 0.86,
      color: roll > 0.86 ? "accent" : roll > 0.62 ? "detail" : "dim",
    };
  });
};

const buildBlocks = (): Block[] => {
  const count = 32;
  const step = 360 / count;
  const r = (R.blockInner + R.blockOuter) / 2;
  const h = R.blockOuter - R.blockInner;
  // Tangential width sized to leave a clean gap between neighbours.
  const w = 2 * r * Math.sin(((step * 0.66) / 2) * (Math.PI / 180));
  return Array.from({ length: count }, (_, i) => ({
    angle: i * step + step / 2,
    r,
    w,
    h,
    rx: h * 0.19,
  }));
};

const buildArcs = (rng: Rng): Arc[] => {
  const widths = [0.0062, 0.0042, 0.0088];
  const arcs = ARC_SPANS.map(([group, a0, a1], i) => ({
    r: R.arc[group as 0 | 1 | 2],
    a0,
    a1,
    width: widths[group],
    group: group as 0 | 1 | 2,
    color: (rng() > 0.86 ? "detail" : "arc") as ColorKey,
    order: i,
  }));
  // Draw order is scrambled so the arcs do not sweep on in a tidy sequence.
  return shuffled(rng, arcs).map((a, i) => ({ ...a, order: i }));
};

const buildTicks = (rng: Rng): Tick[] => {
  const count = 180;
  const step = 360 / count;
  const order = shuffled(
    rng,
    Array.from({ length: count }, (_, i) => i),
  );
  return Array.from({ length: count }, (_, i) => {
    const major = i % 6 === 0;
    return {
      angle: i * step,
      r0: R.tickInner,
      r1: major ? R.tickOuter + 0.009 : R.tickOuter,
      width: major ? 0.0016 : 0.0009,
      color: (major ? "detail" : "dim") as ColorKey,
      order: order.indexOf(i),
    };
  });
};

const buildDataBlocks = (rng: Rng): DataBlock[] => {
  const out: Omit<DataBlock, "order">[] = [];
  const clusters = 14;
  for (let c = 0; c < clusters; c++) {
    // Stratified angles with jitter: clustered, but spread right around the ring.
    const centreAngle = (c / clusters) * 360 + range(rng, -12, 12);
    const centreR = range(rng, 0.152, 0.366);
    const n = Math.floor(range(rng, 5, 13));
    for (let i = 0; i < n; i++) {
      const r = Math.min(0.392, Math.max(0.146, centreR + range(rng, -0.034, 0.034)));
      // Angular spread narrows with radius so every cluster keeps a similar footprint.
      const angle = centreAngle + range(rng, -10, 10) * (0.22 / r);
      const roll = rng();
      const filled = roll > 0.66;
      out.push({
        angle,
        r,
        w: range(rng, 0.006, 0.024),
        h: range(rng, 0.005, 0.02),
        filled,
        hatch: filled ? 0 : rng() > 0.42 ? Math.floor(range(rng, 2, 7)) : 0,
        width: 0.0012,
        color: (roll > 0.88 ? "accent" : roll > 0.36 ? "detail" : "dimWhite") as ColorKey,
      });
    }
  }
  const order = shuffled(
    rng,
    out.map((_, i) => i),
  );
  return out.map((b, i) => ({ ...b, order: order.indexOf(i) }));
};

const buildOuterArcs = (rng: Rng): Arc[] => {
  const spans: readonly (readonly [number, number, number])[] = [
    [0, 4, 88],
    [0, 100, 164],
    [0, 178, 262],
    [0, 276, 352],
    [1, 30, 128],
    [1, 200, 300],
  ];
  const arcs = spans.map(([which, a0, a1], i) => ({
    r: which === 0 ? R.outerBroken : R.outerFaint,
    a0,
    a1,
    width: which === 0 ? 0.0022 : 0.0014,
    group: 2 as const,
    color: "dim" as ColorKey,
    order: i,
  }));
  return shuffled(rng, arcs).map((a, i) => ({ ...a, order: i }));
};

const buildRadials = (rng: Rng): Radial[] => {
  const angles = [12, 68, 133, 176, 221, 264, 309, 344];
  const order = shuffled(
    rng,
    angles.map((_, i) => i),
  );
  return angles.map((angle, i) => ({
    angle,
    r0: R.radialInner + (i % 2 === 0 ? 0 : 0.03),
    r1: R.radialOuter + (i % 3 === 0 ? 0.012 : 0),
    width: 0.0016,
    order: order.indexOf(i),
  }));
};

const buildCornerMarks = (rng: Rng, aspect: number): CornerMark[] => {
  const out: Omit<CornerMark, "order">[] = [];
  const halfW = aspect / 2;
  let guard = 0;
  while (out.length < 54 && guard++ < 6000) {
    const x = range(rng, -halfW, halfW);
    const y = range(rng, -0.5, 0.5);
    const d = Math.hypot(x, y);
    if (d < R.clear + 0.06) continue;
    // Probability ramps with distance, so the marks gather out towards the corners.
    if (rng() > Math.min(1, (d - R.clear - 0.06) * 2.4)) continue;
    const roll = rng();
    // Most marks are flat slivers so they read as HUD rules rather than confetti.
    const flat = roll > 0.34;
    out.push({
      x,
      y,
      w: range(rng, 0.004, flat ? 0.019 : 0.011),
      h: flat ? range(rng, 0.0018, 0.005) : range(rng, 0.005, 0.012),
      filled: roll > 0.82,
      width: 0.0011,
      color: (roll > 0.93 ? "detail" : roll > 0.66 ? "dimWhite" : "dim") as ColorKey,
    });
  }
  const order = shuffled(
    rng,
    out.map((_, i) => i),
  );
  return out.map((m, i) => ({ ...m, order: order.indexOf(i) }));
};

const cache = new Map<string, Layout>();

export const buildLayout = (seed: number, aspect: number): Layout => {
  const key = `${seed}:${aspect.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = mulberry32(seed);
  const layout: Layout = {
    dashes: buildDashes(),
    segments: buildSegments(rng),
    blocks: buildBlocks(),
    arcs: buildArcs(rng),
    ticks: buildTicks(rng),
    dataBlocks: buildDataBlocks(rng),
    outerArcs: buildOuterArcs(rng),
    radials: buildRadials(rng),
    cornerMarks: buildCornerMarks(rng, aspect),
  };
  cache.set(key, layout);
  return layout;
};
