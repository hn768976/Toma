import { catmullRom, resample, type Vec2 } from "../lib/math";
import { hash1, mulberry32, range, type Rng } from "../lib/random";

/**
 * The brain is generated, not imported. A hand-authored profile silhouette is
 * smoothed, given a cortical wobble (the gyri), sampled into points, and the
 * near neighbours are wired together. Nothing here comes from an icon set, so
 * the clip carries no third-party artwork licence.
 *
 * Local units: roughly 2.0 wide by 1.7 tall, centred on the origin, facing
 * left. The scene scales it to about a third of frame height.
 */

export type BrainNode = {
  x: number;
  y: number;
  z: number;
  /** Radius, in local units. */
  size: number;
  /** 0..1 draw-on position; the contour lights up in sequence around it. */
  order: number;
  /** 0..1 position around the profile; drives the travelling contour pulse. */
  param: number;
  /** Shimmer phase and rate. */
  phase: number;
  rate: number;
  /** Baseline brightness. */
  bright: number;
};

export type BrainEdge = { a: number; b: number };

/**
 * Outer cortex profile, clockwise from the frontal pole (left). The bottom run
 * dips into the temporal lobe before rising back to the front, which is what
 * makes the silhouette read as a brain rather than as a lump.
 */
const CORTEX: Vec2[] = [
  { x: -0.98, y: 0.1 },
  { x: -0.93, y: 0.42 },
  { x: -0.76, y: 0.68 },
  { x: -0.46, y: 0.85 },
  { x: -0.1, y: 0.91 },
  { x: 0.26, y: 0.85 },
  { x: 0.58, y: 0.67 },
  { x: 0.82, y: 0.4 },
  { x: 0.93, y: 0.08 },
  { x: 0.9, y: -0.2 },
  { x: 0.71, y: -0.4 },
  { x: 0.44, y: -0.5 },
  { x: 0.16, y: -0.53 },
  { x: -0.11, y: -0.61 },
  { x: -0.38, y: -0.73 },
  { x: -0.65, y: -0.63 },
  { x: -0.85, y: -0.36 },
  { x: -0.99, y: -0.1 },
];

/** Cerebellum: the smaller lobe tucked under the back of the cortex. */
const CEREBELLUM: Vec2[] = [
  { x: 0.27, y: -0.39 },
  { x: 0.52, y: -0.4 },
  { x: 0.67, y: -0.52 },
  { x: 0.63, y: -0.69 },
  { x: 0.43, y: -0.77 },
  { x: 0.24, y: -0.71 },
  { x: 0.17, y: -0.55 },
];

/** Brain stem, a short taper dropping toward the plane. */
const STEM: Vec2[] = [
  { x: 0.24, y: -0.62 },
  { x: 0.1, y: -0.88 },
  { x: 0.0, y: -1.1 },
  { x: -0.13, y: -1.26 },
];

/**
 * The two named fissures plus a set of short creases. Each is an open,
 * hand-placed curve rather than an offset of the outline, so they read as
 * folds instead of stacking into concentric rings. The middle of the profile
 * is deliberately left clear for the "AI".
 */
const SULCI: Vec2[][] = [
  // Lateral (Sylvian) fissure, front to back below centre.
  [
    { x: -0.82, y: -0.16 },
    { x: -0.55, y: -0.14 },
    { x: -0.22, y: -0.16 },
    { x: 0.12, y: -0.14 },
    { x: 0.42, y: -0.2 },
  ],
  // Central sulcus, dropping from the crown toward the front.
  [
    { x: 0.12, y: 0.84 },
    { x: 0.0, y: 0.56 },
    { x: -0.12, y: 0.3 },
    { x: -0.2, y: 0.12 },
  ],
  // Frontal creases.
  [
    { x: -0.9, y: 0.3 },
    { x: -0.66, y: 0.34 },
    { x: -0.44, y: 0.3 },
    { x: -0.3, y: 0.36 },
  ],
  [
    { x: -0.78, y: 0.6 },
    { x: -0.56, y: 0.56 },
    { x: -0.36, y: 0.6 },
  ],
  // Parietal creases behind the central sulcus.
  [
    { x: 0.3, y: 0.8 },
    { x: 0.34, y: 0.55 },
    { x: 0.26, y: 0.34 },
  ],
  [
    { x: 0.62, y: 0.6 },
    { x: 0.56, y: 0.38 },
    { x: 0.62, y: 0.18 },
  ],
  // Occipital crease.
  [
    { x: 0.86, y: 0.06 },
    { x: 0.64, y: 0.0 },
    { x: 0.5, y: 0.12 },
  ],
  // Temporal crease, under the lateral fissure.
  [
    { x: -0.72, y: -0.4 },
    { x: -0.44, y: -0.46 },
    { x: -0.14, y: -0.42 },
  ],
];

const smoothClosed = (anchors: Vec2[], perSpan: number): Vec2[] => {
  const n = anchors.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = anchors[(i - 1 + n) % n];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % n];
    const p3 = anchors[(i + 2) % n];
    for (let s = 0; s < perSpan; s++) out.push(catmullRom(p0, p1, p2, p3, s / perSpan));
  }
  return out;
};

const smoothOpen = (anchors: Vec2[], perSpan: number): Vec2[] => {
  const n = anchors.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(n - 1, i + 2)];
    for (let s = 0; s < perSpan; s++) out.push(catmullRom(p0, p1, p2, p3, s / perSpan));
  }
  out.push(anchors[n - 1]);
  return out;
};

/**
 * Push a closed curve in and out along its own normal to carve the gyri. Two
 * harmonics keep the folds from looking like a plain sine wave; the returned
 * fold amount lets points pack more densely where the folds are tight.
 */
const foldContour = (
  pts: Vec2[],
  amp: number,
  freqA: number,
  freqB: number,
  phase: number,
): Vec2[] => {
  const n = pts.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = ty / len;
    const ny = -tx / len;
    const s = (i / n) * Math.PI * 2;
    const w = Math.sin(s * freqA + phase) * 0.7 + Math.sin(s * freqB + phase * 2.3) * 0.3;
    out.push({ x: p.x + nx * amp * w, y: p.y + ny * amp * w });
  }
  return out;
};

/** Wobble an open curve along its normal, tapering to nothing at both ends. */
const foldOpen = (pts: Vec2[], amp: number, freq: number, phase: number): Vec2[] => {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const t = i / (n - 1);
    const w = Math.sin(t * Math.PI * 2 * freq + phase) * Math.sin(Math.PI * t);
    return { x: p.x + (ty / len) * amp * w, y: p.y - (tx / len) * amp * w };
  });
};

type Curve = { pts: Vec2[]; closed: boolean; weight: number };

const buildCurves = (): Curve[] => {
  const curves: Curve[] = [];
  curves.push({
    pts: foldContour(smoothClosed(CORTEX, 26), 0.033, 14, 29, 0.4),
    closed: true,
    weight: 1,
  });
  curves.push({
    pts: foldContour(smoothClosed(CEREBELLUM, 22), 0.022, 20, 35, 1.7),
    closed: true,
    weight: 0.8,
  });
  curves.push({ pts: smoothOpen(STEM, 20), closed: false, weight: 0.62 });
  SULCI.forEach((anchors, i) => {
    curves.push({
      pts: foldOpen(smoothOpen(anchors, 24), 0.03, 3 + (i % 3), i * 1.7),
      closed: false,
      weight: 0.55,
    });
  });
  return curves;
};

/** Angle around the brain centre, normalised to 0..1 starting at the front. */
const paramOf = (p: Vec2) => {
  const a = Math.atan2(p.y - 0.05, p.x + 0.02);
  return ((a + Math.PI) / (Math.PI * 2) + 0.5) % 1;
};

const build = () => {
  const rng: Rng = mulberry32(0xb2a1_0007);
  const nodes: BrainNode[] = [];
  const curves = buildCurves();

  // Sample each curve at roughly constant arc length. Curvature raises the
  // local density, which puts more points where the folds are tight.
  const pushNode = (p: Vec2, weight: number, curvature: number) => {
    const jitter = 0.006;
    const size = (0.0055 + Math.pow(rng(), 2.4) * 0.013) * (0.62 + weight * 0.55);
    nodes.push({
      x: p.x + range(rng, -jitter, jitter),
      y: p.y + range(rng, -jitter, jitter),
      z: range(rng, -0.07, 0.07) + curvature * 0.02,
      size,
      order: 0,
      param: paramOf(p),
      phase: rng() * Math.PI * 2,
      rate: range(rng, 0.6, 2.4),
      bright: range(rng, 0.45, 1) * (0.6 + weight * 0.45),
    });
  };

  for (const curve of curves) {
    const step = 0.030;
    const sampled = resample(curve.pts, step, curve.closed);
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      const prev = sampled[(i - 1 + sampled.length) % sampled.length];
      const next = sampled[(i + 1) % sampled.length];
      const ax = p.x - prev.x;
      const ay = p.y - prev.y;
      const bx = next.x - p.x;
      const by = next.y - p.y;
      const cross = Math.abs(ax * by - ay * bx) / (step * step + 1e-6);
      pushNode(p, curve.weight, Math.min(1, cross));
      // A tight fold gets a second point half a step along it.
      if (cross > 0.35 && rng() < 0.55) {
        pushNode({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }, curve.weight, cross);
      }
    }
  }

  // A thin scatter of free nodes inside the profile, wired to whatever is
  // near, so the interior reads as a network rather than an empty shell.
  const inside = (p: Vec2) => {
    // Cheap containment test against the cortex ellipse plus the cerebellum.
    const e = Math.pow((p.x + 0.02) / 0.82, 2) + Math.pow((p.y - 0.16) / 0.62, 2);
    return e < 1;
  };
  let guard = 0;
  for (let i = 0; i < 105 && guard < 4000; guard++) {
    const p = { x: range(rng, -0.95, 0.95), y: range(rng, -0.6, 0.9) };
    if (!inside(p)) continue;
    nodes.push({
      x: p.x,
      y: p.y,
      z: range(rng, -0.09, 0.09),
      size: 0.004 + Math.pow(rng(), 2.6) * 0.008,
      order: 0,
      param: paramOf(p),
      phase: rng() * Math.PI * 2,
      rate: range(rng, 0.5, 2.2),
      bright: range(rng, 0.25, 0.7),
    });
    i++;
  }

  // Draw-on order: sweep around the profile, with a little noise so the
  // sequence looks alive rather than mechanical.
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.order = Math.min(1, Math.max(0, n.param * 0.86 + hash1(i) * 0.14));
  }

  // Wire near neighbours together, via a uniform grid so this stays linear.
  const R = 0.062;
  const CELL = R;
  const grid = new Map<string, number[]>();
  const key = (gx: number, gy: number) => `${gx},${gy}`;
  nodes.forEach((n, i) => {
    const gx = Math.floor(n.x / CELL);
    const gy = Math.floor(n.y / CELL);
    const k = key(gx, gy);
    const cell = grid.get(k);
    if (cell) cell.push(i);
    else grid.set(k, [i]);
  });
  const edges: BrainEdge[] = [];
  const seen = new Set<number>();
  const MAX_DEGREE = 4;
  const degree = new Uint8Array(nodes.length);
  nodes.forEach((n, i) => {
    const gx = Math.floor(n.x / CELL);
    const gy = Math.floor(n.y / CELL);
    const near: { j: number; d: number }[] = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cell = grid.get(key(gx + ox, gy + oy));
        if (!cell) continue;
        for (const j of cell) {
          if (j === i) continue;
          const d = Math.hypot(nodes[j].x - n.x, nodes[j].y - n.y);
          if (d < R) near.push({ j, d });
        }
      }
    }
    near.sort((a, b) => a.d - b.d);
    for (const { j } of near.slice(0, MAX_DEGREE)) {
      if (degree[i] >= MAX_DEGREE || degree[j] >= MAX_DEGREE) continue;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      const id = lo * nodes.length + hi;
      if (seen.has(id)) continue;
      seen.add(id);
      degree[i]++;
      degree[j]++;
      edges.push({ a: lo, b: hi });
    }
  });

  // Local extent, used by the scene to place the contact point and the halo.
  let minY = Infinity;
  for (const n of nodes) minY = Math.min(minY, n.y);

  return { nodes, edges, minY };
};

export const BRAIN = build();
