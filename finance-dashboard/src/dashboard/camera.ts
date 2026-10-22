import { BOARD_H, BOARD_W, UNITS_PER_WORLD } from "./constants";

// A camera pose expressed in board units:
//   (u, v)   point on the board the camera looks at
//   dist     distance from that point to the camera
//   tilt     angle between the view direction and the board normal (degrees)
//   az       direction from the look-at point towards the camera, in the board
//            plane (degrees; 0 = towards +u / right, 90 = towards +v / bottom)
//   roll     rotation around the view axis (degrees)
//   fov      vertical field of view (degrees)
export type CameraPose = {
  u: number;
  v: number;
  dist: number;
  tilt: number;
  az: number;
  roll: number;
  fov: number;
};

export type CameraKey = { frame: number } & CameraPose;

const KEYS = ["u", "v", "dist", "tilt", "az", "roll", "fov"] as const;
// Catmull-Rom through the keyframes gives a continuous, drifting move
// without the stop-start feel of per-segment easing.
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

export const sampleCamera = (keys: CameraKey[], frame: number): CameraPose => {
  const last = keys.length - 1;
  let s = 0;
  while (s < last - 1 && frame > keys[s + 1].frame) s++;
  const a = keys[s];
  const b = keys[Math.min(s + 1, last)];
  const t =
    b.frame === a.frame
      ? 0
      : Math.min(1, Math.max(0, (frame - a.frame) / (b.frame - a.frame)));
  const k0 = keys[Math.max(0, s - 1)];
  const k3 = keys[Math.min(last, s + 2)];
  const out = {} as CameraPose;
  for (const k of KEYS) out[k] = catmull(k0[k], a[k], b[k], k3[k], t);
  return out;
};

export const boardToWorld = (u: number, v: number): [number, number] => [
  (u - BOARD_W / 2) / UNITS_PER_WORLD,
  (BOARD_H / 2 - v) / UNITS_PER_WORLD,
];

// Camera position in world space for a pose.
export const poseToWorld = (pose: CameraPose) => {
  const [tx, ty] = boardToWorld(pose.u, pose.v);
  const d = pose.dist / UNITS_PER_WORLD;
  const tilt = (pose.tilt * Math.PI) / 180;
  const az = (pose.az * Math.PI) / 180;
  const horiz = d * Math.sin(tilt);
  return {
    target: [tx, ty, 0] as const,
    // Board +v points down, i.e. world -y.
    position: [
      tx + horiz * Math.cos(az),
      ty - horiz * Math.sin(az),
      d * Math.cos(tilt),
    ] as const,
  };
};

// Reference move: a slow, oblique drift from the chart origin towards the
// growing head of the bars, easing towards a more frontal view.
export const referenceCamera: CameraKey[] = [
  { frame: 0, u: 1000, v: 960, dist: 2300, tilt: 56, az: 102, roll: -6, fov: 18 },
  { frame: 90, u: 1250, v: 940, dist: 3000, tilt: 50, az: 100, roll: 2, fov: 18 },
  { frame: 180, u: 1700, v: 820, dist: 3100, tilt: 42, az: 97, roll: 9, fov: 18 },
  { frame: 359, u: 2080, v: 660, dist: 2750, tilt: 38, az: 95, roll: 20, fov: 18 },
];
