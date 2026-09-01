/**
 * Fixed properties of the tilted scene. Kept in one module so the camera path,
 * the plane and the depth-of-field settings can all agree on the same geometry.
 */

import * as THREE from "three";
import { DESIGN_ASPECT } from "../dashboard/layout";

/** The plane carries the dashboard at its own aspect ratio. */
export const PLANE_HEIGHT = 9;
export const PLANE_WIDTH = PLANE_HEIGHT * DESIGN_ASPECT;

/**
 * Roughly 26° about the vertical axis and 6° about the horizontal, so the panel
 * recedes to the right and leans back a little.
 */
export const PLANE_ROTATION: [number, number, number] = [
  THREE.MathUtils.degToRad(6),
  THREE.MathUtils.degToRad(-26),
  0,
];

export const CAMERA_FOV = 34;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;

/** Unit normal of the tilted plane, in world space. */
export const PLANE_NORMAL = new THREE.Vector3(0, 0, 1).applyEuler(
  new THREE.Euler(...PLANE_ROTATION),
);
