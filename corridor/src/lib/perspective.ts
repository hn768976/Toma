/**
 * The faked-corridor projection.
 *
 * There is no camera and no projection matrix. A horizon line sits at a
 * configurable height with a vanishing point on it. Elements live on two
 * planes — a FLOOR below the horizon and a CEILING above it — and each carries
 * a depth `d` in (0, 1], where d -> 0 is at the horizon and d -> 1 is at the
 * camera. Everything else is derived from d:
 *
 *   y      horizon -> plane edge with a SQUARED curve. The square is what
 *          produces perspective compression: elements bunch up near the
 *          horizon and spread out near the camera. A linear ramp reads flat.
 *   x      spread outward from the vanishing point in proportion to d, so
 *          lanes diverge as they approach.
 *   scale  proportional to d.
 *   speed  falls out of the y curve: dy/dd = 2d, so near elements travel much
 *          faster than far ones for the same rate of change in d.
 *   alpha  fades in off the horizon and back out at the near edge, so the
 *          recycle from d=1 to d=0 is invisible.
 *   blur   sharp in a mid band, blurred at both extremes (see depthBuckets).
 */
import { clamp, smoothstep } from "./math";

export type Plane = "floor" | "ceiling";

export interface CorridorGeometry {
  width: number;
  height: number;
  /** Horizon line, in pixels from the top. */
  horizonY: number;
  /** Vanishing point, in pixels from the left. */
  vanishX: number;
  /** Half-width of the corridor at d = 1, in pixels. */
  spread: number;
  /** y that a floor element reaches at d = 1 (past the bottom edge). */
  floorEdgeY: number;
  /** y that a ceiling element reaches at d = 1 (past the top edge). */
  ceilEdgeY: number;
  /** Centre of the clear band, in pixels from the top. */
  bandCenterY: number;
  /** Half-height of the clear band, in pixels. */
  bandHalf: number;
  /** Alpha that survives inside the band (0 = fully clear). */
  bandResidual: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Where a lane sits on screen at depth `d`. */
export const projectPoint = (
  geo: CorridorGeometry,
  lane: number,
  d: number,
  plane: Plane,
): Point => {
  const edge = plane === "ceiling" ? geo.ceilEdgeY : geo.floorEdgeY;
  return {
    x: geo.vanishX + lane * geo.spread * d,
    // The squared term: this single detail is what makes it a corridor.
    y: geo.horizonY + (edge - geo.horizonY) * d * d,
    };
};

/** Fade in off the horizon, fade back out as the element leaves at d -> 1. */
export const depthAlpha = (d: number, fadeIn = 0.22): number =>
  smoothstep(0, fadeIn, d) * (1 - smoothstep(0.86, 1, d));

/**
 * The open band: a horizontal strip across the middle of the frame kept clear
 * of dense elements so a title can sit in it. Returns the alpha multiplier for
 * a given screen y.
 */
export const bandMask = (geo: CorridorGeometry, y: number): number => {
  if (geo.bandHalf <= 0) return 1;
  const dist = Math.abs(y - geo.bandCenterY);
  const open = smoothstep(geo.bandHalf * 0.45, geo.bandHalf, dist);
  return geo.bandResidual + (1 - geo.bandResidual) * open;
};

export interface DepthWeights {
  far: number;
  mid: number;
  near: number;
}

/**
 * Bucket a depth into the three depth-of-field buffers, cross-fading across
 * the boundaries so an element never pops from sharp to blurred. The weights
 * always sum to 1.
 */
export const depthBuckets = (d: number): DepthWeights => {
  const far = 1 - smoothstep(0.13, 0.27, d);
  const near = smoothstep(0.5, 0.68, d);
  const mid = clamp(1 - far - near, 0, 1);
  const sum = far + mid + near;
  return { far: far / sum, mid: mid / sum, near: near / sum };
};

/** The full per-frame projection of one element. */
export interface Projected {
  d: number;
  x: number;
  y: number;
  /** Depth-derived scale, 0..1. */
  scale: number;
  /** Depth fade * band mask, before any per-renderer alpha. */
  alpha: number;
  buckets: DepthWeights;
}

export const project = (
  geo: CorridorGeometry,
  lane: number,
  d: number,
  plane: Plane,
  fadeIn?: number,
): Projected => {
  const p = projectPoint(geo, lane, d, plane);
  return {
    d,
    x: p.x,
    y: p.y,
    scale: d,
    alpha: depthAlpha(d, fadeIn) * bandMask(geo, p.y),
    buckets: depthBuckets(d),
  };
};
