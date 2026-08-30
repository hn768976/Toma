/**
 * Static anatomy: the lobe outlines, the trachea and the primary bronchi.
 *
 * Every lobe is defined as a ring of control points rather than a hand-written
 * path string, so the same data gives us (a) a smooth closed outline and (b) a
 * dense polygon we can test branch tips against while growing the tree.
 *
 * Coordinates are in the composition's 4K user space: viewBox 0 0 3840 2160.
 */

export type Point = { x: number; y: number };

/** The piece is one closed loop of this many frames, 14.0s at 30fps. */
export const LOOP_FRAMES = 420;
export const FPS = 30;

export const FRAME_WIDTH = 3840;
export const FRAME_HEIGHT = 2160;

/**
 * Viewer-left lobe. This is a posterior view, so the anatomical LEFT lung sits
 * on the left of frame: narrower than its neighbour, and scooped out along its
 * inner edge by the cardiac notch where the heart sits.
 */
const LEFT_LOBE: Point[] = [
  { x: 1826, y: 636 },
  { x: 1706, y: 588 },
  { x: 1560, y: 600 },
  { x: 1436, y: 676 },
  { x: 1352, y: 800 },
  { x: 1310, y: 940 },
  { x: 1308, y: 1090 },
  { x: 1338, y: 1250 },
  { x: 1400, y: 1400 },
  { x: 1478, y: 1510 },
  { x: 1560, y: 1576 },
  { x: 1636, y: 1560 },
  { x: 1704, y: 1466 },
  { x: 1758, y: 1330 },
  { x: 1790, y: 1196 },
  // --- cardiac notch: the inner edge retreats, then returns ---
  { x: 1786, y: 1104 },
  { x: 1706, y: 1042 },
  { x: 1738, y: 952 },
  // --- back out to the apex ---
  { x: 1812, y: 872 },
  { x: 1840, y: 748 },
];

/** Viewer-right lobe: broader, rounder, no notch. */
const RIGHT_LOBE: Point[] = [
  { x: 2014, y: 630 },
  { x: 2150, y: 582 },
  { x: 2312, y: 596 },
  { x: 2450, y: 674 },
  { x: 2552, y: 800 },
  { x: 2626, y: 946 },
  { x: 2630, y: 1110 },
  { x: 2606, y: 1270 },
  { x: 2540, y: 1420 },
  { x: 2450, y: 1530 },
  { x: 2350, y: 1596 },
  { x: 2258, y: 1570 },
  { x: 2180, y: 1470 },
  { x: 2126, y: 1340 },
  { x: 2088, y: 1190 },
  { x: 2062, y: 1030 },
  { x: 2040, y: 872 },
  { x: 2024, y: 736 },
];

/** Index ranges (inclusive) of the inner edge of each lobe, bottom tip -> apex. */
const LEFT_INNER = [11, 19] as const;
const RIGHT_INNER = [11, 17] as const;

const catmullRomSegment = (p0: Point, p1: Point, p2: Point, p3: Point) => ({
  c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
  c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
  end: p2,
});

/** Smooth closed outline through every control point. */
export const closedSplinePath = (pts: Point[]): string => {
  const n = pts.length;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const { c1, c2, end } = catmullRomSegment(
      pts[(i - 1 + n) % n],
      pts[i],
      pts[(i + 1) % n],
      pts[(i + 2) % n],
    );
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }
  return `${d} Z`;
};

/** Smooth open curve through a run of control points. */
export const openSplinePath = (pts: Point[]): string => {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const { c1, c2, end } = catmullRomSegment(
      pts[Math.max(0, i - 1)],
      pts[i],
      pts[i + 1],
      pts[Math.min(pts.length - 1, i + 2)],
    );
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }
  return d;
};

const cubicAt = (p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + e * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + e * p1.y,
  };
};

/** Flatten the same spline into a dense polygon for point-in-shape tests. */
export const splinePolygon = (pts: Point[], perSegment = 14): Point[] => {
  const n = pts.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const { c1, c2, end } = catmullRomSegment(
      pts[(i - 1 + n) % n],
      p1,
      pts[(i + 1) % n],
      pts[(i + 2) % n],
    );
    for (let s = 0; s < perSegment; s++) {
      out.push(cubicAt(p1, c1, c2, end, s / perSegment));
    }
  }
  return out;
};

export const centroidOf = (poly: Point[]): Point => {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
};

/** Shrink a polygon toward its own centroid — used to keep the tree off the edge. */
export const insetPolygon = (poly: Point[], k: number, c: Point): Point[] =>
  poly.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));

export const pointInPolygon = (p: Point, poly: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};

export const boundsOf = (poly: Point[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
};

/**
 * A band hugging the inner edge, suggesting depth without a gradient.
 *
 * Its outer boundary is the lobe outline itself and its inner boundary is that
 * same curve pushed along its normal, so the band has an even width. The width
 * tapers to nothing at both ends, which keeps it from terminating in a hard
 * seam across the middle of the fill.
 */
const innerShadowPath = (
  pts: Point[],
  range: readonly [number, number],
  depth: number,
  perSegment: number,
): string => {
  const poly = splinePolygon(pts, perSegment);
  const arc = poly.slice(range[0] * perSegment, range[1] * perSegment + 1);
  const c = centroidOf(poly);

  const inner = arc
    .map((p, i) => {
      const prev = arc[Math.max(0, i - 1)];
      const next = arc[Math.min(arc.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      let nx = -ty / len;
      let ny = tx / len;
      if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      // Ease the width to zero over the first and last fifth of the run.
      const u = i / (arc.length - 1);
      const fade = Math.min(1, Math.min(u, 1 - u) / 0.2);
      const w = depth * (0.5 - 0.5 * Math.cos(Math.PI * fade));
      return { x: p.x + nx * w, y: p.y + ny * w };
    })
    .reverse();

  const ring = [...arc, ...inner];
  return `M ${ring.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} Z`;
};

export type Lobe = {
  side: "left" | "right";
  /** Smooth outline, used both as the fill and as the clip path. */
  path: string;
  /** Darker band along the inner edge. */
  shadowPath: string;
  polygon: Point[];
  /** The polygon the bronchial tree is grown inside of. */
  growPolygon: Point[];
  centroid: Point;
  /** Where the primary bronchus enters the lobe. */
  hilum: Point;
  /** Direction the tree sets off in from the hilum, in radians. */
  rootAngle: number;
  treeSeed: string;
};

/** The fork of the trachea — also the transform origin for the breath. */
export const FORK: Point = { x: 1920, y: 742 };

export const TRACHEA = {
  topY: 352,
  bottomY: 796,
  halfWidth: 58,
  cornerRadius: 26,
  /** Where each primary bronchus ends and the bronchial tree takes over. */
  leftEnd: { x: 1772, y: 888 } as Point,
  rightEnd: { x: 2086, y: 894 } as Point,
  bronchusWidth: 62,
};

const POLY_DETAIL = 14;

const buildLobe = (
  side: "left" | "right",
  pts: Point[],
  innerRange: readonly [number, number],
  hilum: Point,
  rootAngleDeg: number,
  treeSeed: string,
): Lobe => {
  const polygon = splinePolygon(pts, POLY_DETAIL);
  const centroid = centroidOf(polygon);
  return {
    side,
    path: closedSplinePath(pts),
    shadowPath: innerShadowPath(pts, innerRange, side === "left" ? 96 : 112, POLY_DETAIL),
    polygon,
    growPolygon: insetPolygon(polygon, 0.9, centroid),
    centroid,
    hilum,
    rootAngle: (rootAngleDeg * Math.PI) / 180,
    treeSeed,
  };
};

export const LOBES: Lobe[] = [
  // The tree sets off almost laterally so its first division spreads one limb
  // up toward the apex and the other down toward the base, instead of both
  // heading for the floor.
  buildLobe("left", LEFT_LOBE, LEFT_INNER, TRACHEA.leftEnd, 166, "left-lung-airways"),
  buildLobe("right", RIGHT_LOBE, RIGHT_INNER, TRACHEA.rightEnd, 14, "right-lung-bronchi-v2"),
];

/** The trachea tube: a rounded vertical bar, drawn over the gap between lobes. */
export const tracheaPath = (): string => {
  const { topY, bottomY, halfWidth, cornerRadius: r } = TRACHEA;
  const x0 = FORK.x - halfWidth;
  const x1 = FORK.x + halfWidth;
  return [
    `M ${x0} ${topY + r}`,
    `Q ${x0} ${topY} ${x0 + r} ${topY}`,
    `L ${x1 - r} ${topY}`,
    `Q ${x1} ${topY} ${x1} ${topY + r}`,
    `L ${x1} ${bottomY - r}`,
    `Q ${x1} ${bottomY} ${x1 - r} ${bottomY}`,
    `L ${x0 + r} ${bottomY}`,
    `Q ${x0} ${bottomY} ${x0} ${bottomY - r}`,
    "Z",
  ].join(" ");
};

/** Each primary bronchus, angling down and outward from the fork. */
export const bronchusPath = (end: Point): string =>
  `M ${FORK.x} ${FORK.y - 30} Q ${FORK.x + (end.x - FORK.x) * 0.45} ${
    FORK.y + (end.y - FORK.y) * 0.28
  } ${end.x} ${end.y}`;
