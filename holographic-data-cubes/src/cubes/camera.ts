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
 *  2–5 s    three-quarter corner view of the data cube, slow push
 *  5–10 s   tilt up to the bar blocks growing on its roof
 *  10–12 s  swing down the front of the (now empty) cube to a low angle
 *  12–19 s  pull back / drift while the neighbouring cubes appear
 *  19–21 s  re-angle to a rolled top view, then hold with a slow drift
 *  25–27 s  pull away, tumbling, while everything fades
 */
export const TRACK = new CameraTrack([
  [0.0, 4, -5, 0, 62, -1.1, 0.4, 0.9, 40],
  [1.0, 1.5, -2.5, 0, 34, -0.8, 0.1, 0.4, 40],
  [1.33, 0.3, -0.3, 0, 24, -0.6, -0.05, 0.2, 40],
  [1.85, 0.4, 0.7, 0, 19, -0.6, 0.06, 0.05, 40],
  [2.5, 0.6, 0.8, 0, 13.6, -0.5, 0.05, 0.03, 44],
  [4.0, 0.6, 0.9, 0, 13.0, -0.46, 0.06, 0.03, 44],
  [4.9, 0.6, 1.3, 0, 13.2, -0.36, 0.1, 0.02, 44],
  [5.5, 0.8, 3.8, 0, 14.5, 0.1, 0.22, 0.0, 36],
  [6.2, 0.2, 6.7, 0, 9.8, 0.34, 0.28, 0.0, 40],
  [10.2, 0.2, 6.8, 0, 9.4, 0.42, 0.27, 0.0, 40],
  [10.6, 0.5, 5.0, 0, 11.5, 0.3, 0.45, 0.02, 44],
  [10.9, 0, 3.5, 0, 11.5, 0.1, 0.3, 0.03, 50],
  [11.3, 0, 1.5, 0, 11.5, 0.0, -0.35, 0.02, 58],
  [11.7, 0, 0.8, 0, 14, 0.55, -0.3, -0.02, 58],
  [12.3, 0, 0.6, 0, 15.5, 0.74, -0.27, -0.03, 58],
  [13.2, 0, 0.5, 0, 17, 0.72, -0.3, -0.04, 58],
  [14.0, 0.3, -1.2, 0, 17.5, 0.12, -0.12, -0.01, 58],
  [16.0, 0.6, 0.0, 0, 19, -0.4, -0.42, 0.03, 58],
  [18.7, 0.6, 0.2, 0, 18.5, -0.46, -0.45, 0.05, 58],
  [19.5, 0.3, 0, 0, 18, -0.05, 0.3, -0.12, 58],
  [20.3, 0, 0, 0, 19, 0.2, 0.9, -0.36, 58],
  [21.3, 3, 0, 3, 15, 0.6, 1.3, -0.45, 58],
  [22.6, 0.5, 0, 0.5, 18.5, 0.55, 0.95, -0.44, 58],
  [24.9, 0, 0, 0, 19, 0.64, 0.85, -0.4, 58],
  [25.5, 0, 0, 0, 29, 0.78, 0.8, -0.52, 58],
  [26.0, 0, 0, 0, 37, 0.95, 0.7, -0.75, 58],
  [26.5, 0, 0, 0, 43, 1.4, 0.45, -1.2, 58],
  [27.3, 0, 0, 0, 48, 1.9, 0.3, -1.7, 58],
]);
