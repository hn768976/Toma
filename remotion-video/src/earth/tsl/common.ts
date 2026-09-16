import {
  acos,
  atan,
  clamp,
  dot,
  fract,
  sin,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";

export const PI = Math.PI;

/** World "north" — the Earth meshes are never transformed, so this is fixed. */
export const NORTH = vec3(0, 1, 0);

/**
 * Equirectangular UV for a direction, matching the layout three's
 * SphereGeometry produces (u wraps east from -x, v counts down from the pole).
 * Used to look clouds up from an arbitrary ray hit rather than from the
 * fragment's own UV.
 */
export const directionToUv = (dir: Node): Node => {
  const u = atan(dir.z, dir.x.negate()).div(PI * 2);
  const v = acos(clamp(dir.y, -1, 1)).div(PI).oneMinus();
  return vec2(u, v);
};

/** Cheap deterministic hash of a lattice cell, for the starfield. */
export const hash31 = (p: Node): Node =>
  fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
