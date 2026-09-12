// Camera + lens model for the screen plane.
//
// The whole UI lives on one flat plane that gets tilted in 3D. That means
// depth is not something we can pick per panel by hand — it falls out of
// where the panel sits on the plane. These helpers turn a plane-space
// (x, y) into a camera distance, and a camera distance into a blur
// radius, so the defocus gradient across the frame is consistent with the
// perspective instead of being hand-faked panel by panel.

import { PLANE_HEIGHT, PLANE_WIDTH } from "./constants";

const DEG = Math.PI / 180;

export type Camera = {
  /** CSS `perspective` on the stage, in base px. Lower = wider lens. */
  perspective: number;
  /** Roll, in screen space. Negative lifts the right-hand side. */
  rotateZ: number;
  /** Yaw. Positive pushes the right-hand side away from the viewer. */
  rotateY: number;
  /** Pitch. Positive pushes the top away from the viewer. */
  rotateX: number;
  /** Plane offset from frame centre, in base px. */
  translateX: number;
  translateY: number;
  translateZ: number;
  /** Plane-space point the lens is focused on. */
  focusX: number;
  focusY: number;
  /** Aperture, in blur-px per milli-dioptre. Higher = shallower DoF. */
  aperture: number;
  /** Hard ceiling on blur radius, in base px. */
  maxBlur: number;
};

// Signed depth of a plane-space point, in view space, before the
// perspective divide. Positive is toward the camera.
//
// CSS applies `rotateY(ry) rotateX(rx)` right-to-left, so a point is
// pitched first and then yawed. Carrying that through for a point on the
// z = 0 plane gives the expression below.
export const planeZ = (cam: Camera, x: number, y: number) => {
  const cx = x - PLANE_WIDTH / 2;
  const cy = y - PLANE_HEIGHT / 2;
  const ry = cam.rotateY * DEG;
  const rx = cam.rotateX * DEG;
  return -cx * Math.sin(ry) + cy * Math.sin(rx) * Math.cos(ry) + cam.translateZ;
};

// Distance from the eye to a plane-space point. The eye sits at
// z = perspective looking down -z, which is how CSS defines it.
export const cameraDistance = (cam: Camera, x: number, y: number) =>
  Math.max(cam.perspective - planeZ(cam, x, y), 1);

// Circle of confusion, i.e. how out-of-focus a point is.
//
// Worked in dioptres (1/distance) rather than in distance, because that
// is what a lens actually integrates: the falloff is steep just off the
// focal plane and then flattens out, so distant things go soft quickly
// and then stop getting dramatically softer. Doing this in linear
// distance instead gives a blur that keeps ramping forever and reads as
// a gradient wipe rather than as defocus.
export const blurAt = (cam: Camera, x: number, y: number) => {
  const focus = cameraDistance(cam, cam.focusX, cam.focusY);
  const d = cameraDistance(cam, x, y);
  const coc = cam.aperture * Math.abs(1000 / focus - 1000 / d);
  return Math.min(coc, cam.maxBlur);
};

// Convenience for panels: the blur for a rectangle is sampled at its
// centre. Large panels should be split into depth bands by the caller so
// a single blur value never has to cover too much depth.
export const blurForRect = (
  cam: Camera,
  left: number,
  top: number,
  width: number,
  height: number,
) => blurAt(cam, left + width / 2, top + height / 2);

// The plane transform string, in the order the derivation above assumes.
export const planeTransform = (cam: Camera) =>
  [
    `translate3d(${cam.translateX}px, ${cam.translateY}px, ${cam.translateZ}px)`,
    `rotateZ(${cam.rotateZ}deg)`,
    `rotateY(${cam.rotateY}deg)`,
    `rotateX(${cam.rotateX}deg)`,
  ].join(" ");
