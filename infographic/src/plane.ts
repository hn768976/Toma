import type { DepthConfig, Tilt } from "./theme";
import type { PanelSpec } from "./layout";

export const CANVAS_W = 3840;
export const CANVAS_H = 2160;

export const FPS = 30;
export const DURATION = 450;

/** Values sit at zero until here. */
export const CLIMB_START = 20;
/** Everything has reached its final value here; the last 30 frames hold. */
export const CLIMB_END = 420;

export type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/**
 * ONE affine transform for the whole sheet: rotate, shear, and compress along
 * the receding axis. Parallel lines stay parallel — this is not perspective,
 * and at this scale the difference is invisible.
 */
export const planeMatrix = (
  tilt: Tilt,
  driftX: number,
  driftY: number,
): Matrix => {
  const th = (tilt.rotateDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);

  // R * Shear * Scale, column by column.
  // Shear*Scale maps (1,0) -> (scaleX, 0) and (0,1) -> (shear, scaleY).
  const a = cos * tilt.scaleX;
  const b = sin * tilt.scaleX;
  const c = cos * tilt.shear - sin * tilt.scaleY;
  const d = sin * tilt.shear + cos * tilt.scaleY;

  // The drift is a translation in sheet space, so it runs along the plane's
  // own axes rather than across the screen.
  const tx = driftX;
  const ty = driftY;
  return {
    a,
    b,
    c,
    d,
    e: CANVAS_W / 2 + a * tx + c * ty,
    f: CANVAS_H / 2 + b * tx + d * ty,
  };
};

export const applyMatrix = (ctx: CanvasRenderingContext2D, m: Matrix) => {
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
};

export type DepthBucket = "far" | "mid" | "near";
export const DEPTH_BUCKETS: DepthBucket[] = ["far", "mid", "near"];

/**
 * The depth proxy is distance from a focal band running across the sheet's
 * middle. It drives blur only — everything on the sheet shares one brightness.
 * Because the drift runs along the band, a panel never changes bucket mid-shot.
 */
export const bucketForPanel = (
  panel: PanelSpec,
  depth: DepthConfig,
): DepthBucket => {
  // The year counter is the piece's spine. It stays in the sharp band wherever
  // the layout puts it, so the one element that has to stay legible always is.
  if (panel.kind === "counter") {
    return "mid";
  }
  const centreV = panel.y + panel.h / 2;
  if (Math.abs(centreV) <= depth.bandHalfWidth) {
    return "mid";
  }
  return centreV > 0 ? "near" : "far";
};

export const blurForBucket = (bucket: DepthBucket, depth: DepthConfig) =>
  bucket === "near"
    ? depth.nearBlur
    : bucket === "far"
      ? depth.farBlur
      : depth.midBlur;
