import type {Tilt} from './types';

/**
 * The plane is deliberately larger than the 3840x2160 frame in every direction,
 * so no edge of it is ever visible and blocks are cropped by the frame instead
 * of stopping inside it.
 */
export const PLANE_W = 4900;
export const PLANE_H = 2900;

/** Extra margin on the offscreen buffers so blur does not fade at the frame edge. */
export const BUFFER_PAD = 112;

const ROTATION = 0.055;
const SHEAR = 0.19;

/**
 * ONE affine transform for the whole image: a rotation plus a horizontal shear.
 * Parallel lines stay parallel — this is not, and does not try to be, a real
 * perspective projection.
 */
export const applyPlaneTransform = (
  ctx: CanvasRenderingContext2D,
  tilt: Tilt,
  width: number,
  height: number,
  pad: number,
): void => {
  const dir = tilt === 'right' ? 1 : -1;
  ctx.setTransform(1, 0, 0, 1, width / 2 + pad, height / 2 + pad);
  ctx.rotate(-ROTATION * dir);
  ctx.transform(1, 0, SHEAR * dir, 1, 0, 0);
  ctx.translate(-PLANE_W / 2, -PLANE_H / 2);
};

/** Depth along the plane's receding axis: 0 = near, 1 = far edge. */
export const depthAt = (x: number, tilt: Tilt): number => {
  const t = x / PLANE_W;
  return Math.max(0, Math.min(1, tilt === 'right' ? t : 1 - t));
};

/** Inverse of depthAt — used to build gradients along the receding axis. */
export const xAtDepth = (d: number, tilt: Tilt): number =>
  (tilt === 'right' ? d : 1 - d) * PLANE_W;

export type Bucket = 0 | 1 | 2;

/** Three depth buckets: near (sharp), mid, far. */
export const BUCKET_BLUR: [number, number, number] = [0, 11, 30];

/** Brightness compensation so blurring does not read as dimming. */
export const BUCKET_LIFT: [number, number, number] = [1, 1.16, 1.42];

export const NEAR_END = 0.44;
export const MID_END = 0.72;

export const bucketForDepth = (d: number): Bucket =>
  d < NEAR_END ? 0 : d < MID_END ? 1 : 2;

/**
 * Cross-fade weights so content spanning bucket boundaries (the grid, long
 * webs) ramps between blur levels instead of stepping.
 */
export const bucketWeightStops = (
  bucket: Bucket,
): {d: number; w: number}[] => {
  if (bucket === 0) {
    return [
      {d: 0, w: 1},
      {d: NEAR_END - 0.05, w: 1},
      {d: NEAR_END + 0.08, w: 0},
      {d: 1, w: 0},
    ];
  }
  if (bucket === 1) {
    return [
      {d: 0, w: 0},
      {d: NEAR_END - 0.05, w: 0},
      {d: NEAR_END + 0.08, w: 1},
      {d: MID_END - 0.04, w: 1},
      {d: MID_END + 0.08, w: 0},
      {d: 1, w: 0},
    ];
  }
  return [
    {d: 0, w: 0},
    {d: MID_END - 0.04, w: 0},
    {d: MID_END + 0.08, w: 1},
    {d: 1, w: 1},
  ];
};
