// Every mark on the sheet is a polyline. Keeping geometry as plain point
// arrays (rather than SVG path strings) means the draw-on maths, the wobble
// and the bounding boxes are all computed the same way, deterministically,
// with no DOM measurement.

export type Pt = { x: number; y: number };

export const pathLength = (pts: Pt[]): number => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
};

export const bounds = (pts: Pt[]) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

/**
 * A quadratic-smoothed path through the points. The element carries
 * pathLength={1}, so the draw-on maths stays exact even though smoothing
 * changes the true arc length.
 */
export const toD = (pts: Pt[]): string => {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${r(pts[0].x)} ${r(pts[0].y)} L ${r(pts[1].x)} ${r(pts[1].y)}`;
  }
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${r(pts[i].x)} ${r(pts[i].y)} ${r(mx)} ${r(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${r(last.x)} ${r(last.y)}`;
};

const r = (n: number) => Math.round(n * 10) / 10;

// --- ballpoint wobble ------------------------------------------------------

/** Smooth, low-frequency noise in [-1, 1]. Never scratchy. */
const swell = (t: number, seed: number) =>
  Math.sin(t * 2.3 + seed * 7.13) * 0.62 + Math.sin(t * 5.9 + seed * 3.37) * 0.38;

/**
 * Nudges a polyline off true so it reads as a fast pen line rather than a
 * vector. Confident, not shaky: the displacement varies slowly along the run.
 */
export const wobble = (pts: Pt[], amp = 2, seed = 1): Pt[] => {
  const n = pts.length;
  if (n < 2) return pts;
  return pts.map((p, i) => {
    const t = i / (n - 1);
    return {
      x: p.x + swell(t * 6, seed) * amp,
      y: p.y + swell(t * 6, seed + 11) * amp,
    };
  });
};

/** Densifies a polyline so wobble has somewhere to happen. */
export const resample = (pts: Pt[], step = 14): Pt[] => {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// --- shape builders --------------------------------------------------------
// Each returns one continuous polyline: the mark a pen would make in one go.

export const line = (x1: number, y1: number, x2: number, y2: number, seed = 1): Pt[] =>
  wobble(resample([{ x: x1, y: y1 }, { x: x2, y: y2 }]), 1.6, seed);

/** A box, drawn in one lap starting from the top-left, with a little overshoot. */
export const boxPath = (x: number, y: number, w: number, h: number, seed = 1): Pt[] => {
  const corners: Pt[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x, y },
    { x: x + w * 0.06, y: y - 1 }, // overshoot past the start
  ];
  return wobble(resample(corners), 1.7, seed);
};

export const circlePath = (cx: number, cy: number, rad: number, seed = 1): Pt[] =>
  // Slightly past a full turn, so the line closes and overshoots a touch the
  // way a pen does rather than leaving a gap.
  arcPath(cx, cy, rad, -100, 368, seed);

export const arcPath = (
  cx: number,
  cy: number,
  rad: number,
  fromDeg: number,
  sweepDeg: number,
  seed = 1,
): Pt[] => {
  const steps = Math.max(10, Math.round((Math.abs(sweepDeg) / 360) * rad * 0.9) + 8);
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + (sweepDeg * i) / steps) * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  return wobble(pts, 1.5, seed);
};

export const ellipsePath = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed = 1,
): Pt[] => {
  const steps = 34;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (-100 + (368 * i) / steps) * (Math.PI / 180);
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return wobble(pts, 1.6, seed);
};

export const poly = (points: number[][], seed = 1, amp = 1.7): Pt[] =>
  wobble(resample(points.map(([x, y]) => ({ x, y }))), amp, seed);

/** The two strokes of a crossing-out. Corrections are crossed out, never erased. */
export const crossOut = (
  x: number,
  y: number,
  w: number,
  h: number,
  seed = 1,
): [Pt[], Pt[]] => [
  line(x - 6, y - 4, x + w + 6, y + h + 4, seed),
  line(x + w + 6, y - 4, x - 6, y + h + 4, seed + 5),
];

/**
 * A drawn question mark. The handwriting font's glyph is too calligraphic to
 * read at this size, and this is a diagram, so the pen draws it instead.
 * Returns the hook-and-stem, then the dot.
 */
export const questionMark = (cx: number, baseY: number, h: number, seed = 1): [Pt[], Pt[]] => {
  const u = h / 200;
  const hook = poly(
    [
      [cx - 56 * u, baseY - 138 * u],
      [cx - 48 * u, baseY - 176 * u],
      [cx - 8 * u, baseY - 196 * u],
      [cx + 40 * u, baseY - 180 * u],
      [cx + 54 * u, baseY - 142 * u],
      [cx + 36 * u, baseY - 106 * u],
      [cx + 2 * u, baseY - 82 * u],
      [cx, baseY - 40 * u],
    ],
    seed,
    1.4,
  );
  const dot = arcPath(cx, baseY - 8 * u, 7 * u, 0, 368, seed + 3);
  return [hook, dot];
};

/** Arrow shaft plus the two barbs, as three separate marks. */
export const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  headLen = 26,
  seed = 1,
): [Pt[], Pt[], Pt[]] => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const barb = (spread: number): Pt[] =>
    line(
      x2,
      y2,
      x2 - Math.cos(a + spread) * headLen,
      y2 - Math.sin(a + spread) * headLen,
      seed + spread * 10,
    );
  return [line(x1, y1, x2, y2, seed), barb(0.42), barb(-0.42)];
};
