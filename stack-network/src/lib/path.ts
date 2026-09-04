/**
 * Connector geometry, measured in plain TypeScript.
 *
 * The travelling dots need a point at an arbitrary distance along each
 * connector. SVGGeometryElement.getPointAtLength() would do it, but that
 * needs a laid-out DOM node and an effect, which is exactly what a
 * multi-threaded, out-of-order frame renderer cannot rely on. So every
 * path is flattened to a polyline once, at layout time, and sampled from
 * a cumulative arc-length table instead.
 */

export type Point = { x: number; y: number };

export type PathGeom = {
  /** The `d` attribute for the <path>. */
  d: string;
  /** Total arc length, in board units. */
  length: number;
  /** Flattened polyline, used for measurement and bounds. */
  points: Point[];
  /** Point and tangent angle (degrees) at distance `s` along the path. */
  pointAt: (s: number) => Point & { angle: number };
  start: Point;
  end: Point;
};

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Shared tail of both builders: cumulative lengths + a sampler. */
const fromPolyline = (points: Point[], d: string): PathGeom => {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]));
  }
  const length = cumulative[cumulative.length - 1];

  const pointAt = (s: number) => {
    const target = Math.max(0, Math.min(length, s));
    // Binary search for the segment containing `target`.
    let lo = 0;
    let hi = cumulative.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= target) lo = mid;
      else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const span = cumulative[hi] - cumulative[lo];
    const t = span === 0 ? 0 : (target - cumulative[lo]) / span;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  };

  return {
    d,
    length,
    points,
    pointAt,
    start: points[0],
    end: points[points.length - 1],
  };
};

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * A smooth cubic sweep between two nodes (V1 routing).
 *
 * `bow` pushes both control points perpendicular to the chord, which is
 * what gives the reference its long lazy arcs; `sway` slides them along
 * the chord so the two halves are not mirror images.
 */
export const curve = (
  from: Point,
  to: Point,
  bow: number,
  sway = 0,
  samples = 160,
): PathGeom => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal to the chord.
  const nx = -dy / len;
  const ny = dx / len;

  const c1 = {
    x: from.x + dx * (0.32 + sway) + nx * bow,
    y: from.y + dy * (0.32 + sway) + ny * bow,
  };
  const c2 = {
    x: from.x + dx * (0.68 + sway) + nx * bow,
    y: from.y + dy * (0.68 + sway) + ny * bow,
  };

  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
      y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
    });
  }

  const d = `M ${round(from.x)} ${round(from.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(
    c2.x,
  )} ${round(c2.y)}, ${round(to.x)} ${round(to.y)}`;
  return fromPolyline(points, d);
};

/** Right-angle routing styles for V2. */
export type OrthoMode = "HV" | "VH" | "HVH" | "VHV";

/**
 * A circuit-schematic run of horizontal and vertical segments with square
 * corners (V2 routing). `split` is where the doubled modes turn, as a
 * fraction of the total run.
 */
export const ortho = (
  from: Point,
  to: Point,
  mode: OrthoMode,
  split = 0.5,
): PathGeom => {
  const points: Point[] = [{ ...from }];
  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (Math.abs(last.x - x) > 0.01 || Math.abs(last.y - y) > 0.01) {
      points.push({ x, y });
    }
  };

  if (mode === "HV") {
    push(to.x, from.y);
  } else if (mode === "VH") {
    push(from.x, to.y);
  } else if (mode === "HVH") {
    const midX = from.x + (to.x - from.x) * split;
    push(midX, from.y);
    push(midX, to.y);
  } else {
    const midY = from.y + (to.y - from.y) * split;
    push(from.x, midY);
    push(to.x, midY);
  }
  push(to.x, to.y);

  const d =
    `M ${round(points[0].x)} ${round(points[0].y)} ` +
    points
      .slice(1)
      .map((p) => `L ${round(p.x)} ${round(p.y)}`)
      .join(" ");
  return fromPolyline(points, d);
};

/** Axis-aligned bounds of a path, grown by `pad` on every side. */
export const boundsOf = (geom: PathGeom, pad: number) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of geom.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
};
