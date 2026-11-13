import * as THREE from "three";

// Camera keyframes. Each key: time (s), camera position, look-at target,
// focus distance override (null = distance to target), aperture (blur
// strength for far objects, in 540p half-res pixels) and roll (radians).
export type CamKey = {
  t: number;
  pos: [number, number, number];
  target: [number, number, number];
  aperture: number;
  roll?: number;
  focus?: number;
  /** Exposure multiplier (default 1). */
  exposure?: number;
};

/**
 * Version 1 - matches the reference: low, fast flight over the HUD floor,
 * tilt-up reveal of the helix, slow pull-back, then a drift to a 3/4 view
 * where the helix recedes to the right over the data floor.
 */
export const PATH_V1: CamKey[] = [
  // slow, dark glide low over the blurred data floor
  { t: 0.0, pos: [2.6, -1.05, 5.2], target: [1.6, -2.05, 2.75], aperture: 15, roll: 0.16, exposure: 0.4 },
  { t: 1.3, pos: [1.6, -0.98, 5.3], target: [0.6, -2.0, 2.75], aperture: 15, roll: 0.1, exposure: 0.45 },
  { t: 2.3, pos: [0.7, -0.9, 5.4], target: [-0.4, -1.9, 2.5], aperture: 14, roll: 0.05, exposure: 0.56 },
  // tilt up: the helix slides in across the top edge, still out of focus
  { t: 3.3, pos: [-0.5, -0.74, 5.6], target: [-1.8, -1.75, 0.9], aperture: 14, roll: 0.0, exposure: 0.78 },
  { t: 5.2, pos: [-1.9, -0.52, 5.8], target: [-2.9, -0.8, 0.3], aperture: 14, roll: -0.02, exposure: 0.94 },
  // rack focus onto the helix, slow pull-back
  { t: 7.2, pos: [-3.1, -0.3, 6.2], target: [-3.9, 0.02, 0], aperture: 16, roll: -0.01 },
  { t: 9.4, pos: [-4.0, 0.7, 8.8], target: [-4.0, -0.35, 0], aperture: 24, roll: 0.0 },
  // drift to a high 3/4 view: helix in the upper third receding right
  { t: 11.8, pos: [-6.0, 1.75, 9.8], target: [-2.4, -0.95, 0], aperture: 28, roll: 0.02 },
  { t: 14.8, pos: [-7.4, 1.75, 9.8], target: [-1.4, -0.95, 0], aperture: 28, roll: 0.03 },
  { t: 20.0, pos: [-8.6, 1.65, 9.2], target: [-1.2, -0.9, 0], aperture: 28, roll: 0.04 },
];

/**
 * Version 2 - alternative camera movement: a high overhead crane shot that
 * descends and orbits ~120 degrees around the helix, ending in a low-angle
 * hero view looking up the helix axis as it spirals into depth.
 */
export const PATH_V2: CamKey[] = [
  { t: 0.0, pos: [-1.0, 9.5, 3.0], target: [-3.0, -1.5, 0.2], aperture: 12, roll: 0.35, focus: 10.5, exposure: 0.7 },
  { t: 2.5, pos: [-2.5, 7.4, 4.2], target: [-4.0, -0.6, 0.0], aperture: 12, roll: 0.25, exposure: 0.85 },
  { t: 5.0, pos: [-4.5, 4.4, 6.0], target: [-5.0, 0.0, 0.0], aperture: 12.5, roll: 0.12 },
  { t: 8.0, pos: [-8.0, 1.6, 6.8], target: [-5.6, 0.1, 0.0], aperture: 13, roll: 0.0 },
  { t: 11.0, pos: [-12.6, 0.2, 5.0], target: [-6.4, 0.25, 0.0], aperture: 13, roll: -0.08 },
  { t: 14.5, pos: [-18.5, -0.8, 5.2], target: [-9.5, 0.4, 0.0], aperture: 13.5, roll: -0.12 },
  { t: 17.5, pos: [-22.5, -1.3, 4.6], target: [-11.5, 0.5, -0.2], aperture: 13.5, roll: -0.17 },
  { t: 20.0, pos: [-25.0, -1.45, 3.8], target: [-13.0, 0.5, -0.3], aperture: 13.5, roll: -0.2 },
];

/** V1, 11.8-13.3 s: rack focus to the near-left part of the helix (axis x = -8). */
export const FOCUS_PULL_V1 = { start: 11.8, end: 13.3, axisX: -8 };

const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);

export type CamRig = {
  sample: (t: number) => {
    pos: THREE.Vector3;
    target: THREE.Vector3;
    aperture: number;
    roll: number;
    focus: number | null;
    focusBlend: number;
    exposure: number;
  };
};

/**
 * Centripetal Catmull-Rom through the keys, with time re-parameterised so
 * each key is hit at its timestamp. Velocity stays continuous at the keys.
 */
export const makeRig = (keys: CamKey[]): CamRig => {
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => v3(k.pos)), false, "centripetal");
  const tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => v3(k.target)), false, "centripetal");
  const n = keys.length - 1;
  // map time -> curve parameter u (piecewise linear in keys, smoothed via
  // a monotone cubic so the motion has no visible kinks)
  const times = keys.map((k) => k.t);
  // CatmullRomCurve3.getPoint(u) passes through key i at u = i / n.
  const us = keys.map((_, i) => i / n);
  const scalar = (t: number, get: (k: CamKey) => number) => {
    const i = Math.max(0, Math.min(n - 1, times.findIndex((x, j) => t >= x && t <= times[j + 1])));
    const a = keys[i];
    const b = keys[i + 1];
    const f = (t - a.t) / (b.t - a.t);
    const s = f * f * (3 - 2 * f);
    return get(a) + (get(b) - get(a)) * s;
  };
  const toU = (t: number) => {
    const tt = Math.max(times[0], Math.min(times[n], t));
    let i = 0;
    while (i < n - 1 && tt > times[i + 1]) i++;
    // Hermite with Catmull-Rom style tangents in (t,u) space for smooth speed
    const t0 = times[i];
    const t1 = times[i + 1];
    const u0 = us[i];
    const u1 = us[i + 1];
    const slope = (j: number) => {
      if (j <= 0) return (us[1] - us[0]) / (times[1] - times[0]);
      if (j >= n) return (us[n] - us[n - 1]) / (times[n] - times[n - 1]);
      return (us[j + 1] - us[j - 1]) / (times[j + 1] - times[j - 1]);
    };
    const h = t1 - t0;
    const f = (tt - t0) / h;
    const f2 = f * f;
    const f3 = f2 * f;
    return (
      (2 * f3 - 3 * f2 + 1) * u0 +
      (f3 - 2 * f2 + f) * h * slope(i) +
      (-2 * f3 + 3 * f2) * u1 +
      (f3 - f2) * h * slope(i + 1)
    );
  };
  return {
    sample: (t: number) => {
      const u = Math.max(0, Math.min(1, toU(t)));
      return {
        pos: posCurve.getPoint(u),
        target: tgtCurve.getPoint(u),
        aperture: scalar(t, (k) => k.aperture),
        roll: scalar(t, (k) => k.roll ?? 0),
        exposure: scalar(t, (k) => k.exposure ?? 1),
        // Opening focus override fades into "focus on the look-at target".
        focus: keys[0].focus ?? null,
        focusBlend: 1 - Math.max(0, Math.min(1, (t - 0.4) / 2.6)),
      };
    },
  };
};
