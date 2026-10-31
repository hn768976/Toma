export type Vec3 = [number, number, number];

export type CameraState = {
  pos: Vec3;
  fwd: Vec3;
  right: Vec3;
  up: Vec3;
  tanHalfFov: number;
  worldScale: number;
};

export type CameraMode = "reference" | "lowAngleDolly";

const deg = Math.PI / 180;

const basis = (pitch: number, yaw: number) => {
  // pitch: angle below the horizon; yaw: rotation about world z
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const fwd: Vec3 = [-sy * cp, cy * cp, -sp];
  const right: Vec3 = [cy, sy, 0];
  const up: Vec3 = [-sy * sp, cy * sp, cp];
  return { fwd, right, up };
};

// Smooth ease for camera motion (no velocity jumps at the ends).
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/**
 * reference      — Version 1: static, steep (~64°) high-angle view with mild
 *                  perspective, as in the reference footage.
 * lowAngleDolly  — Version 2: low grazing camera (~31°→26°) that slowly
 *                  glides forward across the surface with a gentle lateral
 *                  drift and yaw, revealing depth and far-field sky sheen.
 */
export const cameraAt = (
  mode: CameraMode,
  progress: number, // 0..1 across the composition
  aspect: number,
): CameraState => {
  if (mode === "reference") {
    const pitch = 64 * deg;
    const vfov = 30 * deg;
    const tanHalfFov = Math.tan(vfov / 2);
    const { fwd, right, up } = basis(pitch, 0);
    const h = 1;
    const centerDist = h / Math.sin(pitch);
    const width = 2 * centerDist * tanHalfFov * aspect;
    return { pos: [0, 0, h], fwd, right, up, tanHalfFov, worldScale: 1 / width };
  }
  // mostly constant-speed glide, softened at both ends
  const e = 0.6 * progress + 0.4 * easeInOutSine(progress);
  const pitch = (31 - 5 * e) * deg;
  const yaw = 4 * Math.sin(progress * Math.PI * 1.2 - 0.6) * deg;
  const vfov = 36 * deg;
  const tanHalfFov = Math.tan(vfov / 2);
  const { fwd, right, up } = basis(pitch, yaw);
  const h = 1 - 0.08 * e;
  // world scale chosen so the mid-frame row spans ~0.8 frame widths
  const centerDist = 1 / Math.sin(31 * deg);
  const width = 2 * centerDist * tanHalfFov * aspect;
  const worldScale = 0.8 / width;
  // forward glide (in unscaled units) + lateral drift
  const y = 2.2 * e;
  const x = 0.25 * Math.sin(progress * Math.PI * 2 * 0.5);
  return { pos: [x, y, h], fwd, right, up, tanHalfFov, worldScale };
};
