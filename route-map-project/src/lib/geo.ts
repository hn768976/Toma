/**
 * The map plane and its camera.
 *
 * The map is a flat rectangle raked away from the camera with a CSS
 * `perspective` + `rotateZ() rotateX()` — no 3D engine. Everything drawn on the
 * plane (basemap, graticule, routes, markers, pin shadows) simply lives inside
 * that transformed element. Pushpins are the exception: they have to stand
 * upright in screen space, so we run the same transform in JS and place them in
 * an untransformed overlay.
 */

import type { LonLat } from "./types";

export interface Tilt {
  /** Rotation about X, degrees. Positive rakes the top of the plane away. */
  tiltXDeg: number;
  /** Rotation about Z, degrees. */
  rollZDeg: number;
  /** CSS perspective distance, px. */
  perspective: number;
}

const RAD = Math.PI / 180;

/** Framing constants, shared by the renderer and the basemap baker. */
export const TILT_X_DEG = 20;
export const ROLL_Z_DEG = -5;
/** Perspective as a multiple of the frame height. */
export const PERSPECTIVE_RATIO = 1.8;

export const tiltFor = (height: number): Tilt => ({
  tiltXDeg: TILT_X_DEG,
  rollZDeg: ROLL_Z_DEG,
  perspective: height * PERSPECTIVE_RATIO,
});

/** Drift amplitude, as a fraction of the frame's smaller dimension. */
export const DRIFT_AMPLITUDE = 0.022;

export interface Projected {
  x: number;
  y: number;
  /** Perspective scale factor at this point; >1 is nearer than the plane centre. */
  scale: number;
}

/**
 * Plane-space point -> screen-space point, matching exactly what the browser
 * does for `perspective(d)` + `rotateZ(a) rotateX(b)` about the element centre.
 */
export const project = (x: number, y: number, t: Tilt): Projected => {
  const a = t.rollZDeg * RAD;
  const b = t.tiltXDeg * RAD;
  const v = y * Math.cos(b);
  const z = y * Math.sin(b);
  const X = x * Math.cos(a) - v * Math.sin(a);
  const Y = x * Math.sin(a) + v * Math.cos(a);
  const s = t.perspective / (t.perspective - z);
  return { x: X * s, y: Y * s, scale: s };
};

/**
 * Screen-space point -> plane-space point. Returns null for points beyond the
 * horizon, which the plane can never cover.
 */
export const unproject = (
  sx: number,
  sy: number,
  t: Tilt,
): { x: number; y: number } | null => {
  const a = t.rollZDeg * RAD;
  const b = t.tiltXDeg * RAD;
  const tb = Math.tan(b);
  const d = t.perspective;
  const m = -sx * Math.sin(a) + sy * Math.cos(a);
  const denom = d + m * tb;
  if (denom <= 1e-6) return null;
  const v = (m * d) / denom;
  const s = d / (d - v * tb);
  const u = (sx * Math.cos(a) + sy * Math.sin(a)) / s;
  return { x: u, y: v / Math.cos(b) };
};

export interface VisibleExtent {
  /** Plane-space bounds of the frame's inverse image (the visible trapezoid). */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Trapezoid width at the far (top) and near (bottom) edges. */
  topWidth: number;
  bottomWidth: number;
}

/**
 * What the frame actually sees, in plane space. The transform is projective, so
 * the frame's inverse image is the quadrilateral through the four inverse-mapped
 * frame corners.
 */
export const visibleExtent = (
  width: number,
  height: number,
  t: Tilt,
): VisibleExtent => {
  const hw = width / 2;
  const hh = height / 2;
  const pts = ([
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ] as const).map(([sx, sy]) => unproject(sx, sy, t));
  if (pts.some((p) => p === null)) {
    throw new Error(
      "Framing puts a frame corner beyond the horizon; reduce tiltXDeg or raise PERSPECTIVE_RATIO.",
    );
  }
  const p = pts as { x: number; y: number }[];
  return {
    xMin: Math.min(...p.map((q) => q.x)),
    xMax: Math.max(...p.map((q) => q.x)),
    yMin: Math.min(...p.map((q) => q.y)),
    yMax: Math.max(...p.map((q) => q.y)),
    topWidth: Math.abs(p[1].x - p[0].x),
    bottomWidth: Math.abs(p[2].x - p[3].x),
  };
};

export interface PlaneFit {
  /** Half-extents of the plane rectangle, plane-space px. */
  halfW: number;
  halfH: number;
}

/**
 * The smallest plane rectangle that still overfills the frame at every edge,
 * with room for the drift and a safety margin.
 *
 * The transform is projective, so the inverse image of the frame rectangle is a
 * quadrilateral: the four frame corners bound it, and nothing in between can
 * escape them.
 */
export const fitPlane = (
  width: number,
  height: number,
  t: Tilt,
  opts: { drift?: number; margin?: number } = {},
): PlaneFit => {
  const drift = opts.drift ?? DRIFT_AMPLITUDE * Math.min(width, height);
  const margin = opts.margin ?? 1.05;
  const hw = width / 2;
  const hh = height / 2;
  let halfW = 0;
  let halfH = 0;
  for (const [sx, sy] of [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ] as const) {
    const p = unproject(sx, sy, t);
    if (!p) {
      // A frame corner sits above the horizon: no finite plane covers it.
      // Fall back to a generous extent rather than producing NaN.
      halfW = Math.max(halfW, width * 4);
      halfH = Math.max(halfH, height * 4);
      continue;
    }
    halfW = Math.max(halfW, Math.abs(p.x));
    halfH = Math.max(halfH, Math.abs(p.y));
  }
  return {
    halfW: (halfW + drift) * margin,
    halfH: (halfH + drift) * margin,
  };
};

export interface MapGeometry {
  /** Plane rectangle, px. */
  planeW: number;
  planeH: number;
  pxPerDegLon: number;
  pxPerDegLat: number;
  centerLon: number;
  centerLat: number;
  /**
   * Plane-space point that the region's centre lon/lat sits on. The visible
   * trapezoid is not symmetric about the plane origin — it reaches further into
   * the distance than it does toward the camera — so the geographic centre is
   * offset to land in the middle of what the camera actually sees.
   */
  originX: number;
  originY: number;
  /** Geographic window covered by the plane rectangle (what the baker fills). */
  window: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  /** Geographic window the camera actually sees — the framing to sanity-check. */
  visible: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  tilt: Tilt;
}

/**
 * Full framing solution for a region at a given output size. The renderer and
 * the basemap baker both call this, so a baked tile always matches the frame.
 */
export const mapGeometry = (
  region: {
    center: LonLat;
    span: number;
    stdParallel?: number;
  },
  width: number,
  height: number,
): MapGeometry => {
  const tilt = tiltFor(height);
  const { halfW, halfH } = fitPlane(width, height, tilt);
  const stdParallel = region.stdParallel ?? region.center[1];
  // `span` is the latitude range between the top and bottom edges of the frame,
  // which is taller than the frame in plane space because the far edge recedes.
  const vis = visibleExtent(width, height, tilt);
  const pxPerDegLat = (vis.yMax - vis.yMin) / region.span;
  const pxPerDegLon = pxPerDegLat * Math.cos(stdParallel * RAD);
  const [centerLon, centerLat] = region.center;
  const originX = (vis.xMin + vis.xMax) / 2;
  const originY = (vis.yMin + vis.yMax) / 2;
  return {
    planeW: halfW * 2,
    planeH: halfH * 2,
    pxPerDegLon,
    pxPerDegLat,
    centerLon,
    centerLat,
    originX,
    originY,
    window: {
      lonMin: centerLon + (-halfW - originX) / pxPerDegLon,
      lonMax: centerLon + (halfW - originX) / pxPerDegLon,
      latMin: centerLat - (halfH - originY) / pxPerDegLat,
      latMax: centerLat - (-halfH - originY) / pxPerDegLat,
    },
    visible: {
      lonMin: centerLon + (vis.xMin - originX) / pxPerDegLon,
      lonMax: centerLon + (vis.xMax - originX) / pxPerDegLon,
      latMin: centerLat - (vis.yMax - originY) / pxPerDegLat,
      latMax: centerLat - (vis.yMin - originY) / pxPerDegLat,
    },
    tilt,
  };
};

/** lon/lat -> plane-space px, origin at the plane centre, +y downward. */
export const toPlane = (
  lon: number,
  lat: number,
  g: MapGeometry,
): [number, number] => [
  g.originX + (lon - g.centerLon) * g.pxPerDegLon,
  g.originY - (lat - g.centerLat) * g.pxPerDegLat,
];
