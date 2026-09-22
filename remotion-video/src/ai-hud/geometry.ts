// ---------------------------------------------------------------------------
// Build-time scene generation.
//
// Everything in this module runs ONCE, at module scope, from fixed seeds. The
// exported values are frozen data — no function here is called during a frame
// render. That is what makes the composition safe for Remotion's out-of-order,
// multi-threaded renderer.
//
// Tuning knobs: TRACE_COUNT changes how many circuit runs radiate from the
// core; BOKEH_COUNT changes the depth-of-field debris. Both re-generate
// deterministically from the same seeds.
// ---------------------------------------------------------------------------

import { BASE_HEIGHT, BASE_WIDTH, CORE_R, CORE_X, CORE_Y } from "./constants";
import { makeRng } from "./random";

/**
 * The trace network is generated in two bands: a long outer set that carries
 * the eye away from the core, and a short inner set that thickens the
 * circuitry immediately around it. Raise either count for a busier hub.
 */
export const TRACE_COUNT = 30;
export const SHORT_TRACE_COUNT = 18;
export const BOKEH_COUNT = 34;

export type Trace = {
  d: string;
  /** Total polyline length, used to size the dash pattern for the pulse. */
  length: number;
  /** Integer number of times the pulse traverses the run over the loop. */
  pulseCycles: number;
  /** Where the pulse starts, as a fraction of the run. */
  pulseShift: number;
  /** Terminal node dot. */
  node: { x: number; y: number; r: number };
  /** Optional perpendicular stub at the far end. */
  stub: string | null;
  /** Intermediate junction dots along the run. */
  joints: { x: number; y: number; r: number }[];
  opacity: number;
  width: number;
};

const DIRS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return { x: Math.cos(a), y: Math.sin(a) };
});

const buildBand = (opts: {
  seed: number;
  count: number;
  minReach: number;
  maxReach: number;
  angleOffset: number;
  segMin: number;
  segMax: number;
  widthMin: number;
  widthMax: number;
}): Trace[] => {
  const rng = makeRng(opts.seed);
  const traces: Trace[] = [];

  // Exit angles are spread around the circle but jittered hard enough that
  // the result never reads as a symmetric star.
  for (let i = 0; i < opts.count; i += 1) {
    const slice = (Math.PI * 2) / opts.count;
    // Jitter kept under a quarter slice so the starburst stays even all round
    // rather than clumping and leaving bare arcs.
    const theta = i * slice + opts.angleOffset + rng.range(-slice * 0.24, slice * 0.24);

    const start = {
      x: CORE_X + Math.cos(theta) * CORE_R * 1.03,
      y: CORE_Y + Math.sin(theta) * CORE_R * 1.03,
    };

    // A short genuinely-radial stub off the disc, then everything else is
    // snapped to the 8-way grid: that mix is what reads as a hub with PCB
    // runs rather than as tentacles.
    const radialLen = rng.range(26, 78);
    let px = start.x + Math.cos(theta) * radialLen;
    let py = start.y + Math.sin(theta) * radialLen;

    const pts: { x: number; y: number }[] = [start, { x: px, y: py }];
    const joints: { x: number; y: number; r: number }[] = [];

    let k = Math.round((theta / (Math.PI / 4)) % 8);
    k = ((k % 8) + 8) % 8;

    const reach = CORE_R * rng.range(opts.minReach, opts.maxReach);
    const segments = rng.int(opts.segMin, opts.segMax);

    for (let sIdx = 0; sIdx < segments; sIdx += 1) {
      if (sIdx > 0) {
        // Turn by 45 or 90 degrees, but only ever into a direction that
        // still carries the run outward from the core.
        const options = [k - 2, k - 1, k + 1, k + 2]
          .map((n) => ((n % 8) + 8) % 8)
          .filter((n) => {
            const dx = px - CORE_X;
            const dy = py - CORE_Y;
            const len = Math.hypot(dx, dy) || 1;
            return (DIRS[n].x * dx + DIRS[n].y * dy) / len > 0.05;
          });
        if (options.length > 0) k = rng.pick(options);
        joints.push({ x: px, y: py, r: rng.range(3.5, 6.5) });
      }
      const remaining = reach - Math.hypot(px - CORE_X, py - CORE_Y);
      const len = Math.max(34, rng.range(0.3, 0.82) * Math.max(remaining, 80));
      px += DIRS[k].x * len;
      py += DIRS[k].y * len;
      pts.push({ x: px, y: py });
    }

    let length = 0;
    for (let n = 1; n < pts.length; n += 1) {
      length += Math.hypot(pts[n].x - pts[n - 1].x, pts[n].y - pts[n - 1].y);
    }

    // A perpendicular cap bar on some terminals, like a PCB pad.
    let stub: string | null = null;
    if (rng.bool(0.45)) {
      const perp = DIRS[(k + 2) % 8];
      const half = rng.range(16, 38);
      stub = `M ${(px - perp.x * half).toFixed(2)} ${(py - perp.y * half).toFixed(2)} L ${(px + perp.x * half).toFixed(2)} ${(py + perp.y * half).toFixed(2)}`;
    }

    traces.push({
      d: pts
        .map((p, n) => `${n === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" "),
      length,
      pulseCycles: rng.pick([1, 2, 2, 3, 3, 4]),
      pulseShift: rng.next(),
      node: { x: px, y: py, r: rng.range(6, 10.5) },
      stub,
      joints,
      opacity: rng.range(0.62, 1),
      width: rng.range(opts.widthMin, opts.widthMax),
    });
  }
  return traces;
};

export const TRACES: Trace[] = [
  ...buildBand({
    seed: 20240711,
    count: TRACE_COUNT,
    minReach: 1.95,
    maxReach: 3.15,
    angleOffset: 0,
    segMin: 3,
    segMax: 5,
    widthMin: 3.1,
    widthMax: 4.6,
  }),
  ...buildBand({
    seed: 606061,
    count: SHORT_TRACE_COUNT,
    minReach: 1.42,
    maxReach: 1.92,
    angleOffset: Math.PI / TRACE_COUNT,
    segMin: 2,
    segMax: 3,
    widthMin: 2.6,
    widthMax: 3.6,
  }),
];

// --- Background circuit-board pattern -------------------------------------
// Drawn on the deepest, most steeply tilted plane at very low opacity.

export type BgLine = { x1: number; y1: number; x2: number; y2: number; w: number };
export type BgRect = { x: number; y: number; w: number; h: number; fill: boolean };

const buildBackgroundPattern = () => {
  const rng = makeRng(90210);
  const lines: BgLine[] = [];
  const rects: BgRect[] = [];
  const spanX = BASE_WIDTH * 1.9;
  const spanY = BASE_HEIGHT * 1.9;
  const ox = -spanX * 0.24;
  const oy = -spanY * 0.24;

  for (let i = 0; i < 150; i += 1) {
    const horizontal = rng.bool(0.55);
    const x = ox + rng.next() * spanX;
    const y = oy + rng.next() * spanY;
    const len = rng.range(120, 900);
    lines.push({
      x1: x,
      y1: y,
      x2: horizontal ? x + len : x,
      y2: horizontal ? y : y + len,
      w: rng.range(2, 5),
    });
  }
  for (let i = 0; i < 90; i += 1) {
    rects.push({
      x: ox + rng.next() * spanX,
      y: oy + rng.next() * spanY,
      w: rng.range(30, 210),
      h: rng.range(18, 90),
      fill: rng.bool(0.3),
    });
  }
  return { lines, rects };
};

export const BG_PATTERN = buildBackgroundPattern();

// --- Bokeh ----------------------------------------------------------------

export type Bokeh = {
  x: number;
  y: number;
  r: number;
  warm: boolean;
  opacity: number;
  /** Lissajous amplitudes and integer frequencies — a closed drift path. */
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  /** false = behind the interface, true = in front of it (heavily blurred). */
  front: boolean;
};

const buildBokeh = (): Bokeh[] => {
  const rng = makeRng(31337);
  const out: Bokeh[] = [];
  // Exactly four warm discs, spread through the set so at least two are in
  // frame at any moment among the blue ones.
  const warmIndices = new Set([3, 11, 19, 26, 31]);
  for (let i = 0; i < BOKEH_COUNT; i += 1) {
    const front = i % 5 === 0;
    out.push({
      x: rng.range(-300, BASE_WIDTH + 300),
      y: rng.range(-200, BASE_HEIGHT + 200),
      r: front ? rng.range(95, 200) : rng.range(26, 82),
      warm: warmIndices.has(i),
      opacity: front ? rng.range(0.2, 0.42) : rng.range(0.3, 0.75),
      ax: rng.range(30, 130),
      ay: rng.range(25, 110),
      fx: rng.pick([1, 1, 2]),
      fy: rng.pick([1, 2, 2, 3]),
      sx: rng.next(),
      sy: rng.next(),
      front,
    });
  }
  return out;
};

export const BOKEH = buildBokeh();

// --- Panel furniture ------------------------------------------------------
// "Rows of tiny illegible text ticks": short rounded bars of varying width,
// which is what reads as unreadable body copy at this scale.

export type TickRow = { y: number; bars: { x: number; w: number }[] };

export const buildTickRows = (
  seed: number,
  width: number,
  rows: number,
  rowGap: number,
  barH = 5,
): { rows: TickRow[]; barH: number } => {
  const rng = makeRng(seed);
  const out: TickRow[] = [];
  for (let r = 0; r < rows; r += 1) {
    const bars: { x: number; w: number }[] = [];
    let x = 0;
    const limit = width * rng.range(0.55, 1);
    while (x < limit) {
      const w = rng.range(9, 36);
      if (x + w > width) break;
      bars.push({ x, w });
      x += w + rng.range(6, 13);
    }
    out.push({ y: r * rowGap, bars });
  }
  return { rows: out, barH };
};

/** A deterministic permutation, used to pick which grid-block cells light. */
export const buildOrder = (seed: number, count: number) => {
  const rng = makeRng(seed);
  const idx = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
};

// --- Counters -------------------------------------------------------------
// Scattered monospace readouts. Each value is a small sum of sines with
// INTEGER cycle counts, so the whole set returns to its frame-0 reading.

export type Counter = {
  x: number;
  y: number;
  size: number;
  label: string | null;
  base: number;
  terms: { amp: number; cycles: number; shift: number }[];
  warm: boolean;
};

const COUNTER_SLOTS: { x: number; y: number; size: number; label: string | null }[] = [
  { x: 2180, y: 640, size: 38, label: null },
  { x: 1120, y: 1420, size: 38, label: null },
  { x: 2300, y: 1260, size: 34, label: "RATE" },
  { x: 900, y: 560, size: 34, label: null },
  { x: 2620, y: 1795, size: 36, label: "IDX" },
  { x: 380, y: 1690, size: 42, label: null },
  { x: 3380, y: 700, size: 34, label: null },
  { x: 1660, y: 1880, size: 36, label: "SYNC" },
  { x: 3120, y: 1640, size: 32, label: null },
  { x: 640, y: 980, size: 32, label: null },
];

const buildCounters = (): Counter[] => {
  const rng = makeRng(777001);
  return COUNTER_SLOTS.map((slot, i) => ({
    ...slot,
    base: rng.range(0.34, 0.66),
    warm: i === 4,
    terms: [
      { amp: rng.range(0.14, 0.26), cycles: rng.pick([2, 3, 4]), shift: rng.next() },
      { amp: rng.range(0.05, 0.12), cycles: rng.pick([5, 7, 9]), shift: rng.next() },
      { amp: rng.range(0.02, 0.05), cycles: rng.pick([11, 13, 17]), shift: rng.next() },
    ],
  }));
};

export const COUNTERS = buildCounters();

// --- Gear path ------------------------------------------------------------
// Generated rather than hand-typed, but still an original path produced by
// this project — no icon library is involved anywhere in this composition.
export const gearPath = (cx: number, cy: number, teeth: number, rIn: number, rOut: number) => {
  const pts: string[] = [];
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i += 1) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a0 = i * step - step * 0.34;
    const a1 = i * step + step * 0.34;
    const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r };
    const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
    pts.push(`${i === 0 ? "M" : "L"} ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`);
    pts.push(`L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
};
