export type Point = { x: number; y: number };

export const pathFromPoints = (points: Point[], close: boolean) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ") + (close ? " Z" : "");

export const polylineLength = (points: Point[]) => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
};

// Cumulative arc lengths for a closed/open polyline, used to place
// "beads" that run along an outline at a constant speed.
export const cumulativeLengths = (points: Point[], close: boolean) => {
  const pts = close ? [...points, points[0]] : points;
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { points: pts, cum, total: cum[cum.length - 1] };
};

export const pointAtLength = (
  sampled: { points: Point[]; cum: number[]; total: number },
  distance: number,
): Point => {
  const { points, cum, total } = sampled;
  const d = ((distance % total) + total) % total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / segLen;
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * t,
    y: points[lo].y + (points[hi].y - points[lo].y) * t,
  };
};

type Circle = { cx: number; cy: number; r: number };

const circleIntersections = (a: Circle, b: Circle): Point[] => {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.r * a.r - l * l));
  const mx = a.cx + (l * dx) / d;
  const my = a.cy + (l * dy) / d;
  return [
    { x: mx + (h * dy) / d, y: my - (h * dx) / d },
    { x: mx - (h * dy) / d, y: my + (h * dx) / d },
  ];
};

const angleOf = (c: Circle, p: Point) => Math.atan2(p.y - c.cy, p.x - c.cx);

// Builds the classic "cloud" outline: a chain of overlapping circles
// closed off by a flat bottom edge. The outline is returned as an
// ordered list of points walking clockwise (screen coordinates) starting
// at the bottom-left corner, so it can be both stroked as a path and
// sampled for particle effects. Sized to fit roughly a 520 x 330 box.
export const buildCloudOutline = (): Point[] => {
  const circles: Circle[] = [
    { cx: 100, cy: 205, r: 78 },
    { cx: 190, cy: 128, r: 92 },
    { cx: 315, cy: 112, r: 108 },
    { cx: 430, cy: 195, r: 86 },
  ];
  const bottomY = 268;
  const centroid = { x: 265, y: 180 };

  // Entry point of the first circle: where it meets the bottom line, on
  // the left side.
  const first = circles[0];
  const last = circles[circles.length - 1];
  const firstDx = Math.sqrt(first.r * first.r - (bottomY - first.cy) ** 2);
  const lastDx = Math.sqrt(last.r * last.r - (bottomY - last.cy) ** 2);
  const start: Point = { x: first.cx - firstDx, y: bottomY };
  const end: Point = { x: last.cx + lastDx, y: bottomY };

  // Outer intersection between neighbouring circles (the one farther
  // from the centroid).
  const joins: Point[] = [];
  for (let i = 0; i < circles.length - 1; i++) {
    const cand = circleIntersections(circles[i], circles[i + 1]);
    cand.sort(
      (p, q) =>
        Math.hypot(q.x - centroid.x, q.y - centroid.y) -
        Math.hypot(p.x - centroid.x, p.y - centroid.y),
    );
    joins.push(cand[0]);
  }

  const points: Point[] = [];
  const stepDeg = 2.5;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const from = i === 0 ? start : joins[i - 1];
    const to = i === circles.length - 1 ? end : joins[i];
    const a0 = angleOf(c, from);
    let a1 = angleOf(c, to);
    // Walk clockwise on screen = increasing angle in y-down coordinates.
    while (a1 <= a0) a1 += Math.PI * 2;
    const steps = Math.max(2, Math.ceil(((a1 - a0) * 180) / Math.PI / stepDeg));
    for (let s = 0; s <= steps; s++) {
      const a = a0 + ((a1 - a0) * s) / steps;
      points.push({ x: c.cx + Math.cos(a) * c.r, y: c.cy + Math.sin(a) * c.r });
    }
  }
  // Flat bottom, right -> left.
  const bottomSteps = 40;
  for (let s = 1; s < bottomSteps; s++) {
    const t = s / bottomSteps;
    points.push({ x: end.x + (start.x - end.x) * t, y: bottomY });
  }
  return points;
};

// Rounded-rectangle outline sampled as points (clockwise from top-left
// corner start), used for the AI chip's energy edge.
export const buildRoundedRectOutline = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Point[] => {
  const points: Point[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const a = a0 + (Math.PI / 2) * (s / steps);
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  const edge = (from: Point, to: Point) => {
    const steps = 30;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  };
  corner(x + r, y + r, Math.PI);
  edge({ x: x + r, y }, { x: x + w - r, y });
  corner(x + w - r, y + r, -Math.PI / 2);
  edge({ x: x + w, y: y + r }, { x: x + w, y: y + h - r });
  corner(x + w - r, y + h - r, 0);
  edge({ x: x + w - r, y: y + h }, { x: x + r, y: y + h });
  corner(x + r, y + h - r, Math.PI / 2);
  edge({ x, y: y + h - r }, { x, y: y + r });
  return points;
};

// Where a horizontal (axis "x": line y = coord) or vertical (axis "y":
// line x = coord) line crosses a closed polygon, sorted ascending. Used
// to stop board traces exactly at the hologram's edge.
export const polygonCrossings = (polygon: Point[], axis: "x" | "y", coord: number): number[] => {
  const out: number[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const aAcross = axis === "x" ? a.y : a.x;
    const bAcross = axis === "x" ? b.y : b.x;
    if (aAcross > coord === bAcross > coord) continue;
    const t = (coord - aAcross) / (bAcross - aAcross);
    out.push(axis === "x" ? a.x + (b.x - a.x) * t : a.y + (b.y - a.y) * t);
  }
  return out.sort((p, q) => p - q);
};

export const transformPoints = (points: Point[], offsetX: number, offsetY: number, scale: number): Point[] =>
  points.map((p) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale }));
