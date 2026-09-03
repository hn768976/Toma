/**
 * Variable-width centreline -> closed silhouette outline.
 *
 * Canvas 2D can only stroke at one uniform `lineWidth`, so a letterform whose
 * weight swells and tapers cannot be drawn as a plain stroked path. This walks
 * a centreline, offsets it by +/- half the local width along the normal, and
 * joins the two sides into a single closed contour. That contour can then be
 * filled (a solid glyph) or stroked (a hollow, neon-tube glyph).
 *
 * Everything here is plain geometry: no colours, no canvas state, no
 * frame-dependent input.
 */

export type Pt = { x: number; y: number };
export type WidthStop = { t: number; w: number };
export type CapStyle = "round" | "flat";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export type RibbonOptions = {
  /** Width profile keyed to normalised arc length (t = 0 start, 1 end). */
  widthStops: WidthStop[];
  capStart?: CapStyle;
  capEnd?: CapStyle;
  /** Segments used to draw each round cap. */
  capSegments?: number;
  /**
   * How width is read between stops. "linear" is right for a plain taper;
   * "smooth" eases each stop's slope in and out, which matters on letterforms
   * because a slope change in the width profile shows up as a visible crease
   * along the edge of the shape.
   */
  interpolation?: "linear" | "smooth";
};

/** Samples a cubic Bezier into `segments + 1` points. */
export const sampleCubic = (
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p1: Pt,
  segments: number,
): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    pts.push({
      x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
    });
  }
  return pts;
};

/**
 * Samples a circular arc into `segments + 1` points. Angles are in degrees and
 * measured the canvas way: 0 points along +x, and increasing angles sweep
 * towards +y (visually clockwise, because canvas y grows downward).
 */
export const sampleArc = (
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  segments: number,
): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / segments;
    const rad = (deg * Math.PI) / 180;
    pts.push({
      x: cx + Math.cos(rad) * radius,
      y: cy + Math.sin(rad) * radius,
    });
  }
  return pts;
};

/**
 * Samples a straight run into `segments + 1` points. Straight sections still
 * need intermediate points so a width profile can taper along them.
 */
export const sampleLine = (a: Pt, b: Pt, segments: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return pts;
};

/** Joins point runs, dropping a duplicated joint where two runs meet. */
export const chain = (...runs: Pt[][]): Pt[] => {
  const out: Pt[] = [];
  for (const run of runs) {
    for (const p of run) {
      const last = out[out.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < 1e-6) continue;
      out.push(p);
    }
  }
  return out;
};

/** Cumulative arc length of a polyline, normalised to [0, 1]. */
const normalisedArcLength = (pts: Pt[]): number[] => {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lengths.push(total);
  }
  if (total === 0) return lengths.map(() => 0);
  return lengths.map((l) => l / total);
};

const smoothstep = (k: number): number => k * k * (3 - 2 * k);

/** Reads a width profile at normalised position `t`. */
const widthAt = (
  stops: WidthStop[],
  t: number,
  interpolation: "linear" | "smooth",
): number => {
  if (t <= stops[0].t) return stops[0].w;
  const last = stops[stops.length - 1];
  if (t >= last.t) return last.w;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const k = (t - a.t) / span;
      return a.w + (b.w - a.w) * (interpolation === "smooth" ? smoothstep(k) : k);
    }
  }
  return last.w;
};

/** Unit normals (left-hand side) along a polyline, via central differences. */
const normals = (pts: Pt[]): Pt[] =>
  pts.map((_, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Rotate the tangent a quarter turn to get the normal.
    return { x: -dy / len, y: dx / len };
  });

export type Ribbon = { path: Path2D; bounds: Bounds };

/**
 * Expands a centreline into a closed variable-width outline.
 *
 * The returned `bounds` cover the outline (not the centreline), which is what
 * a caller needs in order to scale a glyph to an exact target height.
 */
export const ribbon = (centreline: Pt[], options: RibbonOptions): Ribbon => {
  const {
    widthStops,
    capStart = "round",
    capEnd = "round",
    capSegments = 16,
    interpolation = "linear",
  } = options;

  const ts = normalisedArcLength(centreline);
  const ns = normals(centreline);
  const halfWidths = ts.map(
    (t) => widthAt(widthStops, t, interpolation) / 2,
  );

  const left: Pt[] = centreline.map((p, i) => ({
    x: p.x + ns[i].x * halfWidths[i],
    y: p.y + ns[i].y * halfWidths[i],
  }));
  const right: Pt[] = centreline.map((p, i) => ({
    x: p.x - ns[i].x * halfWidths[i],
    y: p.y - ns[i].y * halfWidths[i],
  }));

  // A round cap is a half-turn arc swept around a centreline end point, from
  // the left offset round to the right one. The sweep direction decides which
  // way it bulges: rotating the normal by -90 degrees lands on the tangent,
  // +90 degrees on its reverse. So the far end sweeps negative (bulging
  // forward, past the end of the path) and the near end sweeps positive
  // (bulging backward, before the start of it). Get this backwards and the cap
  // folds into the ribbon, leaving a pinched notch at the terminal.
  const cap = (index: number, style: CapStyle, sweep: 1 | -1): Pt[] => {
    if (style === "flat") return [];
    const centre = centreline[index];
    const n = ns[index];
    const r = halfWidths[index];
    const startAngle = Math.atan2(n.y, n.x);
    const pts: Pt[] = [];
    for (let i = 1; i < capSegments; i++) {
      const a = startAngle + sweep * Math.PI * (i / capSegments);
      pts.push({ x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r });
    }
    return pts;
  };

  const lastIndex = centreline.length - 1;
  const contour = chain(
    left,
    cap(lastIndex, capEnd, -1),
    right.slice().reverse(),
    // Reversed so the start cap runs right-side -> left-side and closes the loop.
    cap(0, capStart, 1).reverse(),
  );

  const path = new Path2D();
  contour.forEach((p, i) => {
    if (i === 0) path.moveTo(p.x, p.y);
    else path.lineTo(p.x, p.y);
  });
  path.closePath();

  const bounds = boundsOf(contour);
  return { path, bounds };
};

/** Axis-aligned bounds of a point set. */
export const boundsOf = (pts: Pt[]): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

/** Union of several bounds. */
export const unionBounds = (all: Bounds[]): Bounds =>
  all.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
