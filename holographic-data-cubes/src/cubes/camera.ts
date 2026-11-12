import * as THREE from "three";

/**
 * Monotone cubic (Fritsch–Carlson) interpolation: smooth like a spline but
 * never overshoots a keyframe, so holds stay still and moves stay tidy.
 */
export function pchip(xs: number[], ys: number[], x: number) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0;
  while (x > xs[i + 1]) i++;
  const h = (k: number) => xs[k + 1] - xs[k];
  const d = (k: number) => (ys[k + 1] - ys[k]) / h(k);
  const slope = (k: number) => {
    if (k === 0) return d(0);
    if (k === n - 1) return d(n - 2);
    const a = d(k - 1);
    const b = d(k);
    if (a * b <= 0) return 0;
    const w1 = 2 * h(k) + h(k - 1);
    const w2 = h(k) + 2 * h(k - 1);
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const hi = h(i);
  const t = (x - xs[i]) / hi;
  const m0 = slope(i);
  const m1 = slope(i + 1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * hi * m0 +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * hi * m1
  );
}

/**
 * Orbit-style keyframe:
 * [time s, targetX, targetY, targetZ, distance, azimuth, elevation, roll, fov°]
 */
export type CamKey = [number, number, number, number, number, number, number, number, number];

export class CameraTrack {
  private ts: number[];
  private cols: number[][];
  constructor(readonly keys: CamKey[]) {
    this.ts = keys.map((k) => k[0]);
    this.cols = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => keys.map((k) => k[c]));
  }
  get start() {
    return this.ts[0];
  }
  apply(cam: THREE.PerspectiveCamera, t: number) {
    const v = this.cols.map((c) => pchip(this.ts, c, t));
    const [tx, ty, tz, dist, az, el, roll, fov] = v;
    cam.position.set(
      tx + dist * Math.cos(el) * Math.sin(az),
      ty + dist * Math.sin(el),
      tz + dist * Math.cos(el) * Math.cos(az),
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(tx, ty, tz);
    cam.rotateZ(roll);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld(true);
  }
}

/**
 * One continuous move (every cube is centred on the origin, edge 10):
 *  0–2 s    tumble in from far away
 *  2–5 s    front view of the data cube, slow push
 *  5–10 s   tilt up to the bar blocks growing on its roof
 *  10–12 s  swing down the front of the (now empty) cube to a low angle
 *  12–19 s  pull back / drift while the neighbouring cubes appear
 *  19–21 s  re-angle to a rolled top view, then hold with a slow drift
 *  25–27 s  pull away, tumbling, while everything fades
 */
export const TRACK = new CameraTrack([
  [0.0, 5, -5, 0, 60, -1.1, 0.5, 0.9, 33],
  [1.0, 3, -2, 0, 34, -0.75, 0.3, 0.45, 33],
  [1.5, 1, -0.3, 0, 27, -0.5, 0.0, 0.14, 28],
  [2.0, 0.8, 0.3, 0, 28.5, -0.34, 0.03, 0.04, 22],
  [2.5, 0.9, 0.5, 0, 27.5, -0.33, 0.03, 0.0, 22],
  [4.0, 1.0, 0.7, 0, 26, -0.3, 0.02, 0.0, 22],
  [4.9, 0.9, 0.9, 0, 25, -0.2, 0.04, 0.0, 22],
  [5.5, 0.8, 3.6, 0, 18, 0.05, 0.24, 0.0, 28],
  [6.2, 1.0, 6.6, 0, 14.0, 0.3, 0.29, 0.0, 33],
  [10.2, 1.0, 6.7, 0, 13.2, 0.4, 0.27, 0.0, 33],
  [10.6, 0.5, 5.0, 0, 12.0, 0.3, 0.45, 0.02, 40],
  [10.9, 0, 3.5, 0, 11.5, 0.1, 0.3, 0.03, 50],
  [11.3, 0, 1.5, 0, 11.5, 0.0, -0.35, 0.02, 58],
  [11.7, 0, 0.8, 0, 14, 0.55, -0.3, -0.02, 58],
  [12.3, 0, 0.6, 0, 15.5, 0.74, -0.27, -0.03, 58],
  [13.2, 0, 0.5, 0, 17, 0.72, -0.3, -0.04, 58],
  [13.95, 0.3, 0.4, 0, 19, 0.12, -0.2, -0.02, 58],
  [16.7, 0.5, 0.3, 0, 19.5, -0.3, -0.4, 0.08, 58],
  [19.0, 0.4, 0.5, 0, 19, -0.12, -0.3, 0.04, 58],
  [19.6, 0.2, 0.2, 0, 17.5, 0.1, 0.25, -0.15, 58],
  [20.2, 0, 0, 0, 19, 0.2, 0.8, -0.38, 58],
  [20.8, 0, 0, 0, 20, 0.3, 1.12, -0.52, 58],
  [21.8, 0, 0, 0, 19.5, 0.55, 0.92, -0.47, 58],
  [25.3, 0, 0, 0, 20.5, 0.68, 0.88, -0.42, 58],
  [25.7, 0, 0, 0, 29, 0.8, 0.8, -0.55, 58],
  [26.0, 0, 0, 0, 37, 0.95, 0.7, -0.75, 58],
  [26.5, 0, 0, 0, 43, 1.4, 0.45, -1.2, 58],
  [27.3, 0, 0, 0, 48, 1.9, 0.3, -1.7, 58],
]);
