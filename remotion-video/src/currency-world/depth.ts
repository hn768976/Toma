import { interpolate } from "remotion";
import {
  BLUR_FAR_GAIN,
  BLUR_NEAR_GAIN,
  FADE_IN_DEPTH,
  FADE_OUT_DEPTH,
  FOCUS_Z,
  MAX_SCREEN_BLUR,
  PERSPECTIVE,
  Z_FAR,
  Z_NEAR,
  Z_SPAN,
} from "./constants";

/**
 * Where an element sits in depth on this frame.
 *
 * `z0` is its offset into the depth slab at frame 0. Adding the camera's
 * forward travel and wrapping means the slab always holds the same
 * number of elements: one leaving through the near plane is matched by
 * one entering at the far plane. Both ends sit inside `depthFade`, so
 * the recycle is never visible.
 */
export const depthAt = (z0: number, camZ: number) => {
  const t = (((z0 + camZ) % Z_SPAN) + Z_SPAN) % Z_SPAN;
  return Z_FAR + t;
};

/** CSS perspective scale factor for a plane at depth `z`. */
export const scaleAt = (z: number) => PERSPECTIVE / (PERSPECTIVE - z);

/** Atmospheric + near-plane fade, 0..1. */
export const depthFade = (z: number) => {
  const inFade = interpolate(z, [Z_FAR, Z_FAR + FADE_IN_DEPTH], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outFade = interpolate(z, [Z_NEAR - FADE_OUT_DEPTH, Z_NEAR], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return inFade * outFade;
};

/**
 * Defocus for a plane at depth `z`, expressed in the element's own local
 * px. The blur budget is decided on screen and then divided by the
 * perspective scale, because CSS applies `filter` before the 3D
 * transform — without the division, distant elements would come out
 * essentially sharp and near ones would smear off the frame.
 */
export const defocusAt = (z: number) => {
  const delta = z - FOCUS_Z;
  const screenBlur = Math.min(
    MAX_SCREEN_BLUR,
    delta > 0 ? delta * BLUR_NEAR_GAIN : -delta * BLUR_FAR_GAIN,
  );
  if (screenBlur < 0.35) return 0;
  return Math.min(40, screenBlur / scaleAt(z));
};

/** `translate3d` that also re-centres the element on its own box. */
export const place = (x: number, y: number, z: number) =>
  `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`;
