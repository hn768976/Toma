import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CAM_DISTANCE,
  CAM_HEIGHT,
  DURATION_IN_FRAMES,
  FOCAL,
} from "./constants";
import { easeInOutSine } from "./random";

export type Vec3 = [number, number, number];

export type Camera = {
  pos: Vec3;
  right: Vec3;
  up: Vec3;
  fwd: Vec3;
  focal: number;
};

export type Projected = { x: number; y: number; z: number };

export type CameraMode = "reference" | "orbit";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

const lookAt = (pos: Vec3, target: Vec3, focal: number): Camera => {
  const fwd = norm(sub(target, pos));
  const right = norm(cross([0, 1, 0], fwd));
  const up = cross(fwd, right);
  return { pos, right, up, fwd, focal };
};

export const cameraAt = (frame: number, mode: CameraMode): Camera => {
  const t = frame / (DURATION_IN_FRAMES - 1);
  if (mode === "reference") {
    // Near-locked-off camera with a very slow push-in, as in the reference.
    const dist = CAM_DISTANCE + 0.12 - 0.3 * easeInOutSine(t);
    const sway = 0.04 * Math.sin(t * Math.PI * 0.9);
    return lookAt(
      [sway, CAM_HEIGHT, -dist],
      [sway * 0.4, CAM_HEIGHT, 0],
      FOCAL,
    );
  }
  // Variant: orbiting crane move. Starts low and to the left, swings ~38deg
  // around the portal while rising to look down into it and pushing in.
  const e = easeInOutSine(t);
  const azimuth = -0.42 + 0.66 * e;
  const elevation = 0.06 + 0.3 * e;
  const dist = 6.6 - 1.5 * e;
  const targetY = 0.95 - 0.35 * e;
  const target: Vec3 = [0, targetY, 0];
  const pos: Vec3 = [
    dist * Math.sin(azimuth) * Math.cos(elevation),
    targetY + dist * Math.sin(elevation) + 0.05,
    -dist * Math.cos(azimuth) * Math.cos(elevation),
  ];
  return lookAt(pos, target, FOCAL * (1 - 0.06 * e));
};

// Projects a world point to base-unit screen coordinates (1920x1080).
// Returns z <= 0 for points behind the camera.
export const project = (cam: Camera, p: Vec3): Projected => {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.fwd);
  if (z <= 0.05) return { x: 0, y: 0, z: -1 };
  const x = dot(d, cam.right);
  const y = dot(d, cam.up);
  return {
    x: BASE_WIDTH / 2 + (cam.focal * x) / z,
    y: BASE_HEIGHT / 2 - (cam.focal * y) / z,
    z,
  };
};
