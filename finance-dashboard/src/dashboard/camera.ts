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

// Reference move: eases in, pans quickly over the chart between ~1.5 s and
// 6 s, then decelerates and settles on the head of the chart by ~9 s.
// A wider lens than before gives the reference's strong foreshortening.
export const referenceCamera: CameraKey[] = [
  { frame: 0, u: 980, v: 1110, dist: 1500, tilt: 57, az: 104, roll: -6, fov: 30 },
  { frame: 40, u: 1020, v: 1100, dist: 1560, tilt: 55, az: 103, roll: -4, fov: 30 },
  { frame: 115, u: 1320, v: 1050, dist: 1650, tilt: 51, az: 100, roll: 3, fov: 30 },
  { frame: 190, u: 1720, v: 950, dist: 1720, tilt: 45, az: 97, roll: 11, fov: 30 },
  { frame: 245, u: 1960, v: 870, dist: 1800, tilt: 41, az: 95, roll: 18, fov: 30 },
  { frame: 285, u: 2010, v: 850, dist: 1900, tilt: 40, az: 95, roll: 20, fov: 30 },
  { frame: 359, u: 2010, v: 850, dist: 1900, tilt: 40, az: 95, roll: 20, fov: 30 },
];
