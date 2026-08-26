import {CONFIG} from '../config';
import {
  applyToPoint,
  invert,
  Mat2D,
  multiply,
  rotation,
  scaling,
  shearAndCompress,
  translation,
} from './matrix';
import {clamp, lerp, smoothstep} from './rng';

/**
 * The tilted plane and the camera that pushes into it.
 *
 * One affine transform carries every element in the piece — cards, code and the
 * hero alike. A frontal badge on a tilted field would read as pasted on, so the
 * hero inherits the same basis as everything else.
 */

const TILT_RADIANS = (CONFIG.plane.tiltDegrees * Math.PI) / 180;

/** Plane space -> unscaled screen space. Rotate, then compress and shear x. */
export const PLANE_BASIS: Mat2D = multiply(
  rotation(TILT_RADIANS),
  shearAndCompress(CONFIG.plane.horizontalCompression, CONFIG.plane.shear),
);

/** The hero sits at plane origin, which is frame centre — the push anchor. */
export const ANCHOR_X = CONFIG.width / 2;
export const ANCHOR_Y = CONFIG.height / 2;

/**
 * Eased 0..1 progress of the push. Ease-in-out, but flattened toward linear so
 * the camera never appears to stop moving at either end of the twelve seconds.
 */
export const pushProgress = (frame: number): number => {
  const t = clamp(frame / (CONFIG.durationInFrames - 1), 0, 1);
  const eased = smoothstep(0, 1, t);
  const LINEAR_BLEND = 0.3;
  return lerp(eased, t, LINEAR_BLEND);
};

/**
 * Parallax: a card's share of the push, from its depth. Near cards scale faster
 * than far ones — without this the push reads as the whole image zooming rather
 * than a camera moving through a scene.
 */
export const depthPushMultiplier = (depth: number): number =>
  lerp(CONFIG.push.nearMultiplier, CONFIG.push.farMultiplier, depth);

export const pushScale = (frame: number, depthMultiplier: number): number =>
  CONFIG.push.from + (CONFIG.push.to - CONFIG.push.from) * pushProgress(frame) * depthMultiplier;

/** Full plane -> screen matrix at a given push scale, anchored on the badge. */
export const cameraMatrix = (scale: number): Mat2D =>
  multiply(translation(ANCHOR_X, ANCHOR_Y), multiply(scaling(scale), PLANE_BASIS));

/**
 * Depth proxy: position along the plane's local y axis. Near the bottom-left is
 * close to camera, upper-right is far. Cards are placed across the plane and
 * their depth is *read back* from where they landed, so the two can never
 * disagree.
 */
export const RECEDE_DIRECTION = (() => {
  const x = 1;
  const y = -0.73;
  const len = Math.hypot(x, y);
  return {x: x / len, y: y / len};
})();

/** Screen space -> plane space, at rest. Used to lay the scene out from the frame. */
export const INVERSE_BASIS = invert(cameraMatrix(CONFIG.push.from));

export const screenToPlane = (x: number, y: number): {x: number; y: number} => {
  const [px, py] = applyToPoint(INVERSE_BASIS, x, y);
  return {x: px, y: py};
};

/**
 * The plane-space box that covers the frame, grown by `overscan` so cards can sit
 * partly outside it. Placing cards in this box — rather than in an arbitrary
 * plane-space range — is what makes the field actually fill the frame.
 */
export const visiblePlaneBounds = (overscan: number) => {
  const corners = [
    screenToPlane(0, 0),
    screenToPlane(CONFIG.width, 0),
    screenToPlane(0, CONFIG.height),
    screenToPlane(CONFIG.width, CONFIG.height),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = ((maxX - minX) * (overscan - 1)) / 2;
  const padY = ((maxY - minY) * (overscan - 1)) / 2;
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
};

const RECEDE_EXTENT = (() => {
  const b = visiblePlaneBounds(1);
  const project = (x: number, y: number) => x * RECEDE_DIRECTION.x + y * RECEDE_DIRECTION.y;
  const values = [
    project(b.minX, b.minY),
    project(b.maxX, b.minY),
    project(b.minX, b.maxY),
    project(b.maxX, b.maxY),
  ];
  return {min: Math.min(...values), max: Math.max(...values)};
})();

/** Depth 0..1 read off a plane position's projection onto the recede axis. */
export const depthAt = (x: number, y: number): number => {
  const projected = x * RECEDE_DIRECTION.x + y * RECEDE_DIRECTION.y;
  return clamp(
    (projected - RECEDE_EXTENT.min) / (RECEDE_EXTENT.max - RECEDE_EXTENT.min),
    0,
    1,
  );
};

/** Cards drift down-left along the plane; near cards travel fastest. */
export const DRIFT_DIRECTION = (() => {
  const len = Math.SQRT2;
  return {x: -1 / len, y: 1 / len};
})();

export const driftSpeed = (depth: number): number =>
  lerp(CONFIG.cards.driftNear, CONFIG.cards.driftFar, depth);

/**
 * How out-of-focus an element is: the focal band holds the hero and its
 * immediate neighbours, and focus falls off toward all four frame edges as well
 * as fore and aft. Returns px of blur at 4K.
 */
export const blurEstimate = (depth: number, screenX: number, screenY: number): number => {
  const {maxBlur, focalDepth, radialFalloffStart, radialFalloffEnd} = CONFIG.dof;

  const depthSpan = Math.max(focalDepth, 1 - focalDepth);
  const depthTerm = (maxBlur * Math.abs(depth - focalDepth)) / depthSpan;

  const nx = (screenX - ANCHOR_X) / (CONFIG.width / 2);
  const ny = (screenY - ANCHOR_Y) / (CONFIG.height / 2);
  const radial = Math.hypot(nx, ny);
  const radialTerm = maxBlur * smoothstep(radialFalloffStart, radialFalloffEnd, radial);

  return clamp(Math.max(depthTerm, radialTerm), 0, maxBlur);
};

export type DepthBucket = 0 | 1 | 2;
export const SHARP: DepthBucket = 0;
export const MID: DepthBucket = 1;
export const FAR: DepthBucket = 2;

export const bucketForBlur = (blur: number): DepthBucket => {
  if (blur < CONFIG.dof.sharpThreshold) return SHARP;
  if (blur < CONFIG.dof.midThreshold) return MID;
  return FAR;
};

export const BUCKET_BLUR: Record<DepthBucket, number> = {
  [SHARP]: CONFIG.dof.sharpBlur,
  [MID]: CONFIG.dof.midBlur,
  [FAR]: CONFIG.dof.farBlur,
};
