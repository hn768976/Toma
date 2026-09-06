import { mulberry32, range, shuffled, type Rng } from "./random";

/**
 * The whole scene is generated from a seed, in units of *frame height*.
 * A radius of 0.2 means "0.2 x the height of the frame". Components multiply
 * by the real height from `useVideoConfig()`, so the design is resolution
 * independent and the 3840x2160 source renders identically at any scale.
 *
 * NOTHING IN THE SCENE OVERLAPS ANYTHING ELSE. Two rules keep that true even
 * though the rings turn at different rates:
 *
 *  1. Every layer owns a radial band, and the bands are disjoint with a
 *     clearance gap between them. Two elements in different bands can never
 *     touch, whatever their rotation.
 *  2. Within a band, elements are placed by rejection sampling against what is
 *     already there, and the whole band rotates as one group — so the relative
 *     angles that were checked at build time hold for the entire render.
 *
 * The one element that crosses a band is the long radial line, which is drawn
 * in the *angular gaps* of the broken outer circle and belongs to the same
 * rotation group as it, so the two never move relative to each other.
 *
 * `verify-layout.ts` asserts all of this against the real numbers.
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
  /** Which arc radius this belongs to; drives its spin rate. */
  group: 0 | 1 | 2;
  color: ColorKey;
  order: number;
};

export type Tick = {
  angle: number;
  r0: number;
  r1: number;
  width: number;
  color: ColorKey;
  order: number;
};

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

/** Minimum clear space between two different layers, as a fraction of height. */
export const BAND_GAP = 0.006;
/** Minimum clear space between two elements sharing a band. */
export const ANGULAR_MARGIN = 0.5;
export const RADIAL_MARGIN = 0.0035;

/**
 * The radial budget, inner to outer. Every entry is the band the layer
 * actually paints into, including stroke width and any pop-in overshoot.
 */
export const R = {
  dashed: 0.095,
  dashedWidth: 0.0014,

  segments: 0.126,
  segmentH: 0.019,
  segmentW: 0.0155,
  segmentStroke: 0.0016,

  /** Scattered-block lanes: [inner, outer] of each. */
  lanes: [
    [0.144, 0.1584],
    [0.234, 0.25],
    [0.3154, 0.3334],
  ] as const,

  blockInner: 0.166,
  blockOuter: 0.208,
  /** Blocks overshoot to this scale as they light up; the band accounts for it. */
  blockOvershoot: 1.06,

  arc: [0.223, 0.26, 0.276] as const,
  arcWidth: [0.0062, 0.0042, 0.0088] as const,

  tickInner: 0.2884,
  tickOuter: 0.3014,
  tickMajorOuter: 0.3094,

  outerFaint: 0.3414,
  outerFaintWidth: 0.0014,
  outerBroken: 0.366,
  outerBrokenWidth: 0.0022,

  radialInner: 0.3485,
  radialOuter: 0.4041,
  radialWidth: 0.0016,

  /** Corner marks live entirely outside this. */
  clear: 0.4181,
};

const TO_DEG = 180 / Math.PI;

/** Angular half-width, in degrees, of a chord of length `w` at radius `r`. */
export const halfAngle = (w: number, r: number) =>
  Math.asin(Math.min(1, w / 2 / r)) * TO_DEG;

const norm = (x: number) => ((x % 360) + 360) % 360;

/** Do two angular spans overlap, allowing for wraparound and a margin? */
export const angularOverlap = (
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  margin: number,
) => {
  const aw = a1 - a0;
  const bw = b1 - b0;
  if (aw + bw + 2 * margin >= 360) return true;
  const as = norm(a0);
  const bs = norm(b0);
  for (const shift of [-360, 0, 360]) {
    const s = bs + shift;
    if (as - margin < s + bw && s - margin < as + aw) return true;
  }
  return false;
};

export type Footprint = { r0: number; r1: number; a0: number; a1: number };

/**
 * The space a scattered block actually occupies, stroke included. The packer
 * and `verify-layout.ts` both go through this, so they cannot disagree.
 */
export const dataBlockFootprint = (b: {
  angle: number;
  r: number;
  w: number;
  h: number;
  width: number;
}): Footprint => {
  const ha = halfAngle(b.w + b.width, b.r);
  const hr = (b.h + b.width) / 2;
  return { r0: b.r - hr, r1: b.r + hr, a0: b.angle - ha, a1: b.angle + ha };
};

type Placed = Footprint;

const collides = (candidate: Placed, placed: readonly Placed[]) =>
  placed.some(
    (p) =>
      candidate.r0 - RADIAL_MARGIN < p.r1 &&
      p.r0 < candidate.r1 + RADIAL_MARGIN &&
      angularOverlap(candidate.a0, candidate.a1, p.a0, p.a1, ANGULAR_MARGIN),
  );

const buildDashes = (): Dash[] => {
  const count = 96;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    a0: i * step,
    a1: i * step + step * 0.55,
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
      w: R.segmentW,
      h: R.segmentH,
      rx: 0.005,
      filled: roll > 0.86,
      color: (roll > 0.86 ? "accent" : roll > 0.62 ? "detail" : "dim") as ColorKey,
    };
  });
};

const buildBlocks = (): Block[] => {
  const count = 32;
  const step = 360 / count;
  const r = (R.blockInner + R.blockOuter) / 2;
  const h = (R.blockOuter - R.blockInner) / R.blockOvershoot;
  // Tangential width sized so neighbours stay clear even at peak overshoot.
  const w = (2 * r * Math.sin(((step * 0.6) / 2) * (Math.PI / 180))) / R.blockOvershoot;
  return Array.from({ length: count }, (_, i) => ({
    angle: i * step + step / 2,
    r,
    w,
    h,
    rx: h * 0.19,
  }));
};

/** Disjoint spans per arc radius, so arcs on one ring never run into each other. */
const ARC_SPANS: readonly (readonly [0 | 1 | 2, number, number])[] = [
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
  [2, 300, 332],
];

const buildArcs = (rng: Rng): Arc[] => {
  const arcs = ARC_SPANS.map(([group, a0, a1], i) => ({
    r: R.arc[group],
    a0,
    a1,
    width: R.arcWidth[group],
    group,
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
      r1: major ? R.tickMajorOuter : R.tickOuter,
      width: major ? 0.0016 : 0.0009,
      color: (major ? "detail" : "dim") as ColorKey,
      order: order.indexOf(i),
    };
  });
};

/**
 * Scattered blocks, clustered inside three lanes. Each candidate is rejected
 * until it clears everything already in its lane, so no two ever touch.
 */
const buildDataBlocks = (rng: Rng): DataBlock[] => {
  const out: Omit<DataBlock, "order">[] = [];
  const placed: Placed[] = [];

  R.lanes.forEach(([laneInner, laneOuter], laneIndex) => {
    const laneHeight = laneOuter - laneInner;
    const clusters = 4 + laneIndex;
    for (let c = 0; c < clusters; c++) {
      // Stratified centres so clusters spread around the ring instead of clumping.
      const centreAngle = ((c + rng() * 0.55) / clusters) * 360 + laneIndex * 17;
      const window = range(rng, 9, 17);
      const attemptsPerBlock = 26;
      const wanted = Math.floor(range(rng, 5, 11));
      for (let i = 0; i < wanted; i++) {
        for (let attempt = 0; attempt < attemptsPerBlock; attempt++) {
          const h = range(rng, 0.005, Math.min(0.014, laneHeight - 0.003));
          const r = range(rng, laneInner + h / 2, laneOuter - h / 2);
          const w = range(rng, 0.006, 0.026);
          const angle = centreAngle + range(rng, -window, window);
          const width = 0.0012;
          const candidate = dataBlockFootprint({ angle, r, w, h, width });
          if (collides(candidate, placed)) continue;
          placed.push(candidate);
          const roll = rng();
          const filled = roll > 0.66;
          out.push({
            angle,
            r,
            w,
            h,
            filled,
            hatch: filled ? 0 : rng() > 0.42 ? Math.floor(range(rng, 2, 7)) : 0,
            width,
            color: (roll > 0.88 ? "accent" : roll > 0.36 ? "detail" : "dimWhite") as ColorKey,
          });
          break;
        }
      }
    }
  });

  const order = shuffled(
    rng,
    out.map((_, i) => i),
  );
  return out.map((b, i) => ({ ...b, order: order.indexOf(i) }));
};

/** Broken outer circle. The gaps between these spans are where the radials go. */
const OUTER_BROKEN_SPANS: readonly (readonly [number, number])[] = [
  [2, 58],
  [70, 128],
  [142, 196],
  [212, 250],
  [266, 318],
  [332, 356],
];

const OUTER_FAINT_SPANS: readonly (readonly [number, number])[] = [
  [30, 128],
  [200, 300],
  [318, 350],
];

const buildOuterArcs = (rng: Rng): Arc[] => {
  const arcs: Omit<Arc, "order">[] = [
    ...OUTER_BROKEN_SPANS.map(([a0, a1]) => ({
      r: R.outerBroken,
      a0,
      a1,
      width: R.outerBrokenWidth,
      group: 2 as const,
      color: "dim" as ColorKey,
    })),
    ...OUTER_FAINT_SPANS.map(([a0, a1]) => ({
      r: R.outerFaint,
      a0,
      a1,
      width: R.outerFaintWidth,
      group: 2 as const,
      color: "dim" as ColorKey,
    })),
  ];
  return shuffled(rng, arcs).map((a, i) => ({ ...a, order: i }));
};

/**
 * Long radial lines, one per wide gap in the broken outer circle. They share
 * that circle's rotation group, so they stay in their gaps for the whole run.
 */
const buildRadials = (rng: Rng): Radial[] => {
  const clearance = 3;
  const angles: number[] = [];
  for (let i = 0; i < OUTER_BROKEN_SPANS.length; i++) {
    const end = OUTER_BROKEN_SPANS[i][1];
    const nextStart =
      i === OUTER_BROKEN_SPANS.length - 1
        ? OUTER_BROKEN_SPANS[0][0] + 360
        : OUTER_BROKEN_SPANS[i + 1][0];
    const gap = nextStart - end;
    const halfWidth = halfAngle(R.radialWidth, R.outerBroken);
    if (gap < 2 * (clearance + halfWidth)) continue;
    angles.push(norm((end + nextStart) / 2));
  }
  const order = shuffled(
    rng,
    angles.map((_, i) => i),
  );
  return angles.map((angle, i) => ({
    angle,
    r0: R.radialInner,
    r1: R.radialOuter - (i % 3 === 0 ? 0.012 : 0),
    width: R.radialWidth,
    order: order.indexOf(i),
  }));
};

/** Sparse marks out past the assembly, rejection-sampled so none touch. */
const buildCornerMarks = (rng: Rng, aspect: number): CornerMark[] => {
  const out: Omit<CornerMark, "order">[] = [];
  const halfW = aspect / 2;
  const margin = 0.006;
  let guard = 0;
  while (out.length < 54 && guard++ < 12000) {
    const roll = rng();
    // Most marks are flat slivers so they read as HUD rules rather than confetti.
    const flat = roll > 0.34;
    const w = range(rng, 0.004, flat ? 0.019 : 0.011);
    const h = flat ? range(rng, 0.0018, 0.005) : range(rng, 0.005, 0.012);
    const x = range(rng, -halfW + w, halfW - w);
    const y = range(rng, -0.5 + h, 0.5 - h);
    // Farthest corner of the mark must clear the assembly.
    const d = Math.hypot(Math.abs(x) + w / 2, Math.abs(y) + h / 2);
    if (d < R.clear) continue;
    // Probability ramps with distance, so the marks gather out towards the corners.
    if (rng() > Math.min(1, (d - R.clear) * 2.4)) continue;
    const hit = out.some(
      (m) =>
        Math.abs(m.x - x) < (m.w + w) / 2 + margin &&
        Math.abs(m.y - y) < (m.h + h) / 2 + margin,
    );
    if (hit) continue;
    out.push({
      x,
      y,
      w,
      h,
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
