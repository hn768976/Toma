// Minimal pinhole-camera pipeline. Everything in the scene lives on flat
// planes (u = along the plane, v = up) that share one orientation and
// differ only by an offset along their common normal. World -> camera
// -> perspective divide gives screen position plus a per-point scale
// factor that we use to size line widths, dots and text with depth.

import { FOCAL_LENGTH, NEAR_PLANE, PLANE_YAW } from "./constants";

export type Vec3 = { x: number; y: number; z: number };

export type Camera = {
  pos: Vec3;
  yaw: number;
  pitch: number;
  focal: number;
  cx: number;
  cy: number;
};

export type Plane = { origin: Vec3; u: Vec3; v: Vec3 };

export type Projected = {
  x: number;
  y: number;
  // Screen px per world unit at this point's depth.
  s: number;
  // Distance in front of the camera (positive).
  depth: number;
};

// Plane rotated about the vertical axis by PLANE_YAW. With a negative
// yaw, +u heads away from the camera (into -z) so the left side of the
// plane is nearest and the right side recedes.
export const makePlane = (depth: number): Plane => {
  const u = { x: Math.cos(PLANE_YAW), y: 0, z: Math.sin(PLANE_YAW) };
  const v = { x: 0, y: 1, z: 0 };
  // n = u x v, points toward +z (the camera) for small |yaw|.
  const n = { x: -Math.sin(PLANE_YAW), y: 0, z: Math.cos(PLANE_YAW) };
  return { origin: { x: n.x * depth, y: n.y * depth, z: n.z * depth }, u, v };
};

export const planePoint = (p: Plane, u: number, v: number): Vec3 => ({
  x: p.origin.x + u * p.u.x + v * p.v.x,
  y: p.origin.y + u * p.u.y + v * p.v.y,
  z: p.origin.z + u * p.u.z + v * p.v.z,
});

export const makeCamera = (
  pos: Vec3,
  yaw: number,
  pitch: number,
  width: number,
  height: number,
): Camera => ({
  pos,
  yaw,
  pitch,
  focal: FOCAL_LENGTH,
  cx: width / 2,
  cy: height / 2,
});

export const project = (cam: Camera, w: Vec3): Projected | null => {
  const x = w.x - cam.pos.x;
  const y = w.y - cam.pos.y;
  const z = w.z - cam.pos.z;

  // Undo camera yaw (rotation about Y) ...
  const cy = Math.cos(-cam.yaw);
  const sy = Math.sin(-cam.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;

  // ... then camera pitch (rotation about X).
  const cp = Math.cos(-cam.pitch);
  const sp = Math.sin(-cam.pitch);
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;

  if (z2 > -NEAR_PLANE) return null;
  const s = cam.focal / -z2;
  return { x: cam.cx + x1 * s, y: cam.cy - y2 * s, s, depth: -z2 };
};

export const projectPlane = (
  cam: Camera,
  plane: Plane,
  u: number,
  v: number,
): Projected | null => project(cam, planePoint(plane, u, v));

// Atmospheric falloff: things far from the camera fade a little.
export const fog = (depth: number) =>
  Math.max(0.22, Math.min(1, 1.28 - depth / 5000));
