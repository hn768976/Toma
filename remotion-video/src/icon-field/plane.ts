import type { VariantConfig } from "./variants";

/**
 * The whole piece sits on ONE plane, faked with a single affine transform:
 * rotate by the variant's tilt, then shear horizontally. Parallel lines stay
 * parallel — this is deliberately not true perspective.
 *
 * Plane-local coordinates:
 *   local x = the DEPTH axis. Under the tilt it maps toward the upper-right
 *             of the screen, so -x is near the camera (lower-left) and +x is
 *             far (upper-right). Every focus / size / brightness decision
 *             keys off this single value.
 *   local y = the DRIFT axis. The layout tiles along it with period BLOCK,
 *             and the sheet translates along it by exactly one BLOCK per
 *             loop, which is what closes the loop.
 */

export const CANVAS_W = 3840;
export const CANVAS_H = 2160;
export const LOOP_FRAMES = 450;

/** Local depth half-range: local x spans [-DEPTH_HALF, +DEPTH_HALF]. */
export const DEPTH_HALF = 2400;
/** Layout period along the drift axis (local y), in local units. */
export const BLOCK = 2200;

export interface PlaneGeom {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
  /** Inverse of the linear part, for mapping screen offsets back to local. */
  ia: number;
  ib: number;
  ic: number;
  id: number;
}

export const planeGeom = (
  cfg: VariantConfig,
  camX: number,
  camY: number,
): PlaneGeom => {
  const th = (cfg.tiltDeg * Math.PI) / 180;
  const sh = Math.tan((cfg.shearDeg * Math.PI) / 180);
  const s = cfg.tileScale;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  // M = R(th) · Shear(sh) · s, columns: M·(1,0) and M·(sh,1)·? — the shear
  // sends (x,y) -> (x + sh*y, y) before rotating.
  const a = s * cos;
  const b = s * sin;
  const c = s * (cos * sh - sin);
  const d = s * (sin * sh + cos);
  const det = a * d - b * c;
  return {
    a,
    b,
    c,
    d,
    tx: CANVAS_W / 2 + camX,
    ty: CANVAS_H / 2 + camY,
    ia: d / det,
    ib: -b / det,
    ic: -c / det,
    id: a / det,
  };
};

export const localToScreen = (
  g: PlaneGeom,
  x: number,
  y: number,
): [number, number] => [g.a * x + g.c * y + g.tx, g.b * x + g.d * y + g.ty];

/** Map a screen-space offset (dx,dy) into plane-local units. */
export const screenDeltaToLocal = (
  g: PlaneGeom,
  dx: number,
  dy: number,
): [number, number] => [g.ia * dx + g.ic * dy, g.ib * dx + g.id * dy];

/**
 * 0 = nearest the camera (lower-left), 1 = farthest (upper-right).
 * Normalised to the VISIBLE depth range: at higher tile scales the screen
 * shows a smaller local window, so depth is stretched by the scale — the
 * focal falloff always spans the frame, not the (mostly off-screen) block.
 */
export const depth01 = (x: number, tileScale: number): number => {
  const d = (x * tileScale + DEPTH_HALF) / (2 * DEPTH_HALF);
  return d < 0 ? 0 : d > 1 ? 1 : d;
};

export type DepthBucket = "near" | "mid" | "far";

/** Focal band across the middle depths; near + far go soft. */
export const depthBucket = (d: number): DepthBucket =>
  d < 0.26 ? "near" : d < 0.76 ? "mid" : "far";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Faked perspective: near elements large, far elements small. */
export const iconDepthScale = (d: number): number => lerp(1.5, 0.46, d);
export const tileDepthScale = (d: number): number => lerp(1.26, 0.68, d);

/** Far elements lose contrast, sinking toward the background wash. */
export const depthAlpha = (d: number): number => {
  if (d < 0.26) return 0.92;
  if (d < 0.76) return 1;
  return lerp(1, 0.55, (d - 0.76) / 0.24);
};
