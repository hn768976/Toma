import { CROSSING } from "./geometry";

export type Variant = "v1" | "v2";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll: number; // radians
  focus: number; // focus distance in world units
  screen: [number, number]; // where the target lands on screen (0..1, 0..1 from top-left)
};

const deg = Math.PI / 180;

const orbit = (
  target: [number, number, number],
  dist: number,
  azimuth: number,
  elevation: number,
): [number, number, number] => [
  target[0] + dist * Math.cos(elevation) * Math.sin(azimuth),
  target[1] + dist * Math.sin(elevation),
  target[2] + dist * Math.cos(elevation) * Math.cos(azimuth),
];

// Smooth (Catmull-Rom) interpolation through keyframes, so the camera never
// stops at a keyframe. Clamped outside the key range.
const spline = (times: number[], values: number[], x: number) => {
  if (x <= times[0]) return values[0];
  const n = times.length - 1;
  if (x >= times[n]) return values[n];
  let i = 0;
  while (x > times[i + 1]) i++;
  const t0 = times[i];
  const t1 = times[i + 1];
  const u = (x - t0) / (t1 - t0);
  const p0 = values[Math.max(i - 1, 0)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(i + 2, n)];
  // tangents scaled to segment length (non-uniform Catmull-Rom)
  const tm0 = i > 0 ? ((p2 - p0) / (t1 - times[i - 1])) * (t1 - t0) : p2 - p1;
  const tm1 = i + 2 <= n ? ((p3 - p1) / (times[i + 2] - t0)) * (t1 - t0) : p2 - p1;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * tm0 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * tm1;
};

// t: 0..1 over the whole composition (20 s)
export const getCamera = (variant: Variant, t: number): CameraState => {
  const sec = t * 20;
  const target = CROSSING;
  if (variant === "v1") {
    // Reference move: opens on a wedge (both ribbons fanning toward camera
    // from a bright apex at upper right), swings round into the "X" by ~7 s,
    // then keeps tilting down until the sheets read as edge-on filaments.
    const K = [0, 7, 10, 20];
    const az = spline(K, [-40, -6, 4, 14], sec) * deg;
    const el = spline(K, [30, 16, 12, 4], sec) * deg;
    const dist = spline(K, [10.2, 11.0, 11.5, 13], sec);
    return {
      position: orbit(target, dist, az, el),
      target,
      fov: 42,
      roll: spline(K, [-4, 0, 2, 7], sec) * deg,
      focus: dist,
      screen: [spline(K, [0.74, 0.56, 0.52, 0.46], sec), spline(K, [0.58, 0.72, 0.77, 0.72], sec)],
    };
  }
  // V2: a reverse-angle orbit - the camera circles behind the collision,
  // craning down from a high three-quarter view, so the ribbons sweep past
  // in the opposite direction and never resolve into V1's frontal X.
  const K = [0, 10, 20];
  const az = spline(K, [140, 180, 222], sec) * deg;
  const el = spline(K, [34, 20, 9], sec) * deg;
  const dist = spline(K, [12.8, 12.6, 11.6], sec);
  return {
    position: orbit(target, dist, az, el),
    target,
    fov: 44,
    roll: spline(K, [6, 0, -7], sec) * deg,
    focus: dist,
    screen: [0.5, 0.56],
  };
};
