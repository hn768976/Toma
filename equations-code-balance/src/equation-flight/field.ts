import { FORMULAS } from "./formulas";
import { mulberry32, range, type Rng } from "../common/random";
import { TAU } from "../common/math";

/**
 * The equation field, generated once at module load from a fixed seed.
 * All distances are design pixels on the 3840x2160 grid.
 *
 * The field is one block of depth D, repeated three times along the view
 * axis. Over LOOP frames the camera travels exactly D, so at frame LOOP every
 * plane is back where it was at frame 0 relative to the camera.
 */
export const LOOP = 600;
/** CSS perspective: distance from the eye to the screen plane (scale 1). */
export const PERSPECTIVE = 2400;
/** Depth of one repeating block. */
export const BLOCK_DEPTH = 3700;
export const BLOCKS = 3;
/** Planes nearer than this are behind the lens and never drawn. */
export const NEAR = 160;
export const FAR = NEAR + BLOCKS * BLOCK_DEPTH;
export const FORMULAS_PER_BLOCK = 52;
export const GRAPHS_PER_BLOCK = 14;

export type GraphPath = { d: string; width: number; opacity: number };
export type GraphSpec = { w: number; h: number; paths: GraphPath[] };

export type PlaneSpec = {
  id: number;
  x: number;
  y: number;
  /** Position inside the block, 0 ≤ z < BLOCK_DEPTH. */
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
} & (
  | { kind: "formula"; formula: number; fontSize: number }
  | { kind: "graph"; graph: GraphSpec }
);

// ---------------------------------------------------------------------------
// Hand-drawn graph shapes
// ---------------------------------------------------------------------------

/** A polyline with small perpendicular jitter, so it reads as drawn by hand. */
const sketch = (rng: Rng, pts: Array<[number, number]>, jitter: number) => {
  const out = pts.map(([x, y], i) => {
    if (i === 0 || i === pts.length - 1) return [x, y] as [number, number];
    return [x + range(rng, -jitter, jitter), y + range(rng, -jitter, jitter)] as [
      number,
      number,
    ];
  });
  // Quadratic smoothing through midpoints keeps it a single fluid stroke.
  let d = `M${out[0][0].toFixed(1)},${out[0][1].toFixed(1)}`;
  for (let i = 1; i < out.length - 1; i++) {
    const mx = (out[i][0] + out[i + 1][0]) / 2;
    const my = (out[i][1] + out[i + 1][1]) / 2;
    d += ` Q${out[i][0].toFixed(1)},${out[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = out[out.length - 1];
  d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return d;
};

const line = (rng: Rng, x0: number, y0: number, x1: number, y1: number, j: number) => {
  const n = 5;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  }
  return sketch(rng, pts, j);
};

const axes = (rng: Rng, w: number, h: number, ox: number, oy: number, sw: number) => {
  const paths: GraphPath[] = [
    { d: line(rng, 0, oy, w, oy, 2), width: sw, opacity: 0.9 },
    { d: line(rng, ox, h, ox, 0, 2), width: sw, opacity: 0.9 },
    // arrow heads
    { d: `M${w - 16},${oy - 9} L${w},${oy} L${w - 16},${oy + 9}`, width: sw, opacity: 0.9 },
    { d: `M${ox - 9},16 L${ox},0 L${ox + 9},16`, width: sw, opacity: 0.9 },
  ];
  const ticks = 6 + Math.floor(rng() * 4);
  for (let i = 1; i < ticks; i++) {
    const tx = ox + ((w - ox - 24) * i) / ticks;
    paths.push({ d: `M${tx.toFixed(1)},${oy - 8} L${tx.toFixed(1)},${oy + 8}`, width: sw * 0.7, opacity: 0.8 });
  }
  for (let i = 1; i < Math.max(3, ticks - 3); i++) {
    const ty = oy - ((oy - 24) * i) / Math.max(3, ticks - 3);
    paths.push({ d: `M${ox - 8},${ty.toFixed(1)} L${ox + 8},${ty.toFixed(1)}`, width: sw * 0.7, opacity: 0.8 });
  }
  return paths;
};

const makeGraph = (rng: Rng, type: number): GraphSpec => {
  const w = range(rng, 340, 600);
  const h = w * range(rng, 0.55, 0.75);
  const sw = range(rng, 2.6, 3.6);
  const curve = (f: (t: number) => [number, number], n = 28) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) pts.push(f(i / n));
    return sketch(rng, pts, 1.2);
  };
  switch (type % 5) {
    case 0: {
      // Bell curve with mean line
      const oy = h * 0.9;
      const paths = axes(rng, w, h, w * 0.08, oy, sw);
      const sigma = range(rng, 0.12, 0.2);
      paths.push({
        d: curve((t) => [w * 0.1 + t * w * 0.84, oy - (oy - h * 0.12) * Math.exp(-((t - 0.5) ** 2) / (2 * sigma * sigma))]),
        width: sw * 1.2,
        opacity: 1,
      });
      paths.push({ d: line(rng, w * 0.52, oy, w * 0.52, h * 0.12, 1.5), width: sw * 0.6, opacity: 0.55 });
      return { w, h, paths };
    }
    case 1: {
      // Upward parabola through the origin region
      const ox = w * 0.5;
      const oy = h * 0.82;
      const paths = axes(rng, w, h, ox, oy, sw);
      const a = range(rng, 0.8, 1.2);
      paths.push({
        d: curve((t) => {
          const x = (t - 0.5) * 2;
          return [ox + x * w * 0.4, oy - a * x * x * h * 0.7 + h * 0.08];
        }),
        width: sw * 1.2,
        opacity: 1,
      });
      return { w, h, paths };
    }
    case 2: {
      // Sine wave over axes
      const oy = h * 0.5;
      const paths = axes(rng, w, h, w * 0.06, oy, sw);
      const cycles = 1 + Math.floor(rng() * 2);
      paths.push({
        d: curve((t) => [w * 0.06 + t * w * 0.88, oy - Math.sin(t * TAU * cycles) * h * 0.32], 40),
        width: sw * 1.2,
        opacity: 1,
      });
      return { w, h, paths };
    }
    case 3: {
      // Construction lines: a triangle with a dropped perpendicular
      const ax = w * 0.05;
      const ay = h * 0.92;
      const bx = w * 0.95;
      const by = h * 0.92;
      const cx = w * range(rng, 0.3, 0.65);
      const cy = h * 0.08;
      return {
        w,
        h,
        paths: [
          { d: line(rng, ax, ay, bx, by, 1.5), width: sw, opacity: 1 },
          { d: line(rng, bx, by, cx, cy, 1.5), width: sw, opacity: 1 },
          { d: line(rng, cx, cy, ax, ay, 1.5), width: sw, opacity: 1 },
          { d: line(rng, cx, cy, cx, ay, 1.5), width: sw * 0.6, opacity: 0.6 },
          { d: `M${cx},${ay - 22} L${cx + 22},${ay - 22} L${cx + 22},${ay}`, width: sw * 0.6, opacity: 0.6 },
          { d: line(rng, -w * 0.05, h * 0.5, w * 1.05, h * 0.4, 2), width: sw * 0.5, opacity: 0.4 },
        ],
      };
    }
    default: {
      // Straight line fit through scattered points
      const ox = w * 0.08;
      const oy = h * 0.9;
      const paths = axes(rng, w, h, ox, oy, sw);
      paths.push({ d: line(rng, ox, oy - h * 0.1, w * 0.92, h * 0.12, 1), width: sw * 1.1, opacity: 1 });
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9;
        const px = ox + t * (w * 0.92 - ox);
        const py = oy - h * 0.1 - t * (oy - h * 0.1 - h * 0.12) + range(rng, -h * 0.08, h * 0.08);
        paths.push({ d: `M${(px - 5).toFixed(1)},${(py - 5).toFixed(1)} L${(px + 5).toFixed(1)},${(py + 5).toFixed(1)} M${(px - 5).toFixed(1)},${(py + 5).toFixed(1)} L${(px + 5).toFixed(1)},${(py - 5).toFixed(1)}`, width: sw * 0.7, opacity: 0.85 });
      }
      return { w, h, paths };
    }
  }
};

// ---------------------------------------------------------------------------
// Plane placement
// ---------------------------------------------------------------------------

const buildField = (): PlaneSpec[] => {
  const rng = mulberry32(483571667);
  const total = FORMULAS_PER_BLOCK + GRAPHS_PER_BLOCK;

  // Stratified depths so the field has no empty stretches, then shuffled
  // so formulas and graphs are mixed through the depth.
  const depths = Array.from({ length: total }, (_, i) => ((i + range(rng, 0.1, 0.9)) / total) * BLOCK_DEPTH);
  for (let i = depths.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [depths[i], depths[j]] = [depths[j], depths[i]];
  }

  // Formula order: every formula once (shuffled), then repeats, starred
  // formulas twice as likely to repeat.
  const order: number[] = FORMULAS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const stars = FORMULAS.map((f, i) => (f.star ? i : -1)).filter((i) => i >= 0);
  while (order.length < FORMULAS_PER_BLOCK) {
    order.push(rng() < 0.65 ? stars[Math.floor(rng() * stars.length)] : Math.floor(rng() * FORMULAS.length));
  }

  const planes: PlaneSpec[] = [];
  for (let i = 0; i < total; i++) {
    // Keep a clear tube around the line of sight so nothing flies straight
    // into the lens, and spread the rest over a wide frustum.
    let x = 0;
    let y = 0;
    for (;;) {
      x = range(rng, -2900, 2900);
      y = range(rng, -1650, 1650);
      if ((x / 520) ** 2 + (y / 320) ** 2 > 1) break;
    }
    const base = {
      id: i,
      x,
      y,
      z: depths[i],
      rotX: range(rng, -14, 14),
      rotY: range(rng, -22, 22),
      rotZ: range(rng, -7, 7),
    };
    if (i < FORMULAS_PER_BLOCK) {
      const formula = order[i];
      const star = FORMULAS[formula].star;
      planes.push({
        ...base,
        kind: "formula",
        formula,
        fontSize: star ? range(rng, 62, 104) : range(rng, 44, 84),
      });
    } else {
      planes.push({ ...base, kind: "graph", graph: makeGraph(rng, i) });
    }
  }
  return planes;
};

export const PLANES: PlaneSpec[] = buildField();

// ---------------------------------------------------------------------------
// Speed streaks: faint dust motes that smear along the view direction.
// ---------------------------------------------------------------------------
export type Streak = { x: number; y: number; z: number; len: number; w: number };

export const STREAKS: Streak[] = (() => {
  const rng = mulberry32(7741);
  return Array.from({ length: 90 }, () => {
    let x = 0;
    let y = 0;
    for (;;) {
      x = range(rng, -2400, 2400);
      y = range(rng, -1400, 1400);
      if ((x / 380) ** 2 + (y / 240) ** 2 > 1) break;
    }
    return { x, y, z: rng() * BLOCK_DEPTH, len: range(rng, 260, 620), w: range(rng, 1.4, 3.2) };
  });
})();

// ---------------------------------------------------------------------------
// Light rays: fixed wedge layout, rotated as one group.
// ---------------------------------------------------------------------------
export type Ray = { angle: number; halfWidth: number; length: number; strength: number };

export const RAYS: Ray[] = (() => {
  const rng = mulberry32(2026);
  return Array.from({ length: 26 }, (_, i) => ({
    angle: (i / 26) * 360 + range(rng, -6, 6),
    halfWidth: range(rng, 0.8, 3.2),
    length: range(rng, 0.45, 1.0),
    strength: range(rng, 0.35, 1),
  }));
})();
