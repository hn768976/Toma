import { mulberry32 } from "./random";

export type Point = readonly [number, number];

export type GearProfile = {
  /** Number of teeth. */
  teeth: number;
  /** Radius at the tooth tips. */
  rOuter: number;
  /** Radius at the tooth roots (the valley between two teeth). */
  rRoot: number;
  /** Fraction of one tooth pitch occupied by the flat tip. */
  tipFrac?: number;
  /** Fraction of one tooth pitch used by each flank (root -> tip ramp). */
  flankFrac?: number;
  /** Samples per tooth before the curve is smoothed. */
  samplesPerTooth?: number;
  /** Phase offset in turns, useful to stagger identical gears. */
  phase?: number;
};

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/**
 * Radius of the gear profile at a given fraction `p` of one tooth pitch.
 * Flat root -> smooth flank -> flat tip -> smooth flank -> flat root, which is
 * what gives the reference gears their slightly organic, rounded teeth.
 */
const toothRadius = (
  p: number,
  rOuter: number,
  rRoot: number,
  tipFrac: number,
  flankFrac: number,
) => {
  const t1 = 0.5 - tipFrac / 2;
  const t2 = 0.5 + tipFrac / 2;
  const t0 = t1 - flankFrac;
  const t3 = t2 + flankFrac;
  if (p <= t0 || p >= t3) return rRoot;
  if (p >= t1 && p <= t2) return rOuter;
  const k =
    p < t1 ? smoothstep((p - t0) / flankFrac) : smoothstep((t3 - p) / flankFrac);
  return rRoot + (rOuter - rRoot) * k;
};

/** Samples the gear outline as a closed ring of points, centred on the origin. */
export const gearOutlinePoints = ({
  teeth,
  rOuter,
  rRoot,
  tipFrac = 0.34,
  flankFrac = 0.16,
  samplesPerTooth = 14,
  phase = 0,
}: GearProfile): Point[] => {
  const points: Point[] = [];
  const total = teeth * samplesPerTooth;
  for (let i = 0; i < total; i++) {
    const p = (i % samplesPerTooth) / samplesPerTooth;
    const angle = ((i / total) + phase) * Math.PI * 2;
    const r = toothRadius(p, rOuter, rRoot, tipFrac, flankFrac);
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return points;
};

/**
 * Closed Catmull-Rom spline through `points`, emitted as cubic beziers so the
 * teeth stay smooth at 4K instead of showing polygon facets.
 */
export const smoothClosedPath = (points: Point[]): string => {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M ${at(0)[0].toFixed(3)} ${at(0)[1].toFixed(3)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(3)} ${c1y.toFixed(3)}, ${c2x.toFixed(3)} ${c2y.toFixed(3)}, ${p2[0].toFixed(3)} ${p2[1].toFixed(3)}`;
  }
  return `${d} Z`;
};

/** Procedural gear outline path, centred on the origin. */
export const gearOutlinePath = (profile: GearProfile): string =>
  smoothClosedPath(gearOutlinePoints(profile));

export type Mesh = {
  points: Point[];
  edges: readonly (readonly [number, number])[];
};

/**
 * Wireframe polygon mesh version of a gear: the tooth profile plus a few
 * jittered inner rings, wired to their nearest neighbours. Deterministic for a
 * given seed.
 */
export const gearMesh = (
  profile: GearProfile,
  {
    seed = 1,
    rings = [1, 0.8, 0.6, 0.42, 0.24],
    ringCounts,
    jitter = 0.04,
    neighbours = 3,
    outlineSamplesPerTooth = 6,
  }: {
    seed?: number;
    rings?: number[];
    ringCounts?: number[];
    jitter?: number;
    neighbours?: number;
    outlineSamplesPerTooth?: number;
  } = {},
): Mesh => {
  const rand = mulberry32(seed);
  const points: Point[] = [];
  const outline = gearOutlinePoints({
    ...profile,
    samplesPerTooth: outlineSamplesPerTooth,
  });
  points.push(...outline);

  rings.slice(1).forEach((ringScale, index) => {
    const count =
      ringCounts?.[index + 1] ?? Math.max(6, Math.round(outline.length * ringScale * 0.55));
    for (let i = 0; i < count; i++) {
      const angle = ((i + rand() * 0.6) / count) * Math.PI * 2;
      const r =
        profile.rRoot * ringScale * (1 + (rand() - 0.5) * 2 * jitter);
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
  });

  const edgeKeys = new Set<string>();
  const edges: (readonly [number, number])[] = [];
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(a < b ? [a, b] : [b, a]);
  };

  // The silhouette is always wired edge to edge, so the mesh still reads as a
  // gear rather than as a cloud of triangles.
  for (let i = 0; i < outline.length; i++) {
    addEdge(i, (i + 1) % outline.length);
  }

  points.forEach((p, i) => {
    const near = points
      .map((q, j) => ({ j, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }))
      .filter((entry) => entry.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbours);
    near.forEach(({ j }) => addEdge(i, j));
  });

  return { points, edges };
};

/** Arc path on a circle, angles in degrees, 0deg pointing right, clockwise. */
export const arcPath = (
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string => {
  const sweep = endDeg - startDeg;
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r] as const;
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(endDeg);
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(3)} ${y2.toFixed(3)}`;
};

/** Point on a circle centred at (cx, cy). Angles in degrees. */
export const polar = (
  cx: number,
  cy: number,
  r: number,
  deg: number,
): Point => {
  const rad = (deg * Math.PI) / 180;
  return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
};
