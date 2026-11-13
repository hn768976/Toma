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
};

/**
 * Version 1 - matches the reference: low, fast flight over the HUD floor,
 * tilt-up reveal of the helix, slow pull-back, then a drift to a 3/4 view
 * where the helix recedes to the right over the data floor.
 */
export const PATH_V1: CamKey[] = [
  { t: 0.0, pos: [17.0, -1.2, 5.6], target: [14.0, -2.6, 1.6], aperture: 11, roll: 0.22, focus: 2.2 },
  { t: 1.0, pos: [12.6, -1.1, 6.0], target: [9.4, -3.2, 1.6], aperture: 10, roll: 0.1 },
  { t: 2.1, pos: [7.6, -1.0, 6.2], target: [4.4, -3.3, 1.4], aperture: 8.5, roll: -0.03 },
  { t: 3.1, pos: [2.6, -0.6, 6.0], target: [-0.8, -0.3, 0], aperture: 8, roll: -0.04 },
  { t: 4.3, pos: [-2.4, -0.35, 5.4], target: [-4.0, 0.2, 0], aperture: 7.5, roll: -0.02 },
  { t: 6.5, pos: [-3.8, 0.0, 6.6], target: [-4.4, 0.1, 0], aperture: 7.5, roll: -0.01 },
  { t: 9.0, pos: [-4.2, 0.6, 9.4], target: [-4.2, 0.0, 0], aperture: 7.5, roll: 0.0 },
  { t: 11.5, pos: [-5.8, 1.3, 10.2], target: [-3.6, -0.1, 0], aperture: 8, roll: 0.02 },
  { t: 14.5, pos: [-10.2, 1.8, 8.6], target: [-3.0, -0.4, 0], aperture: 8.5, roll: 0.04 },
  { t: 20.0, pos: [-12.0, 1.9, 7.3], target: [-2.8, -0.5, 0], aperture: 8.5, roll: 0.05 },
];

/**
 * Version 2 - alternative camera movement: a high overhead crane shot that
 * descends and orbits ~120 degrees around the helix, ending in a low-angle
 * hero view looking up the helix axis as it spirals into depth.
 */
export const PATH_V2: CamKey[] = [
  { t: 0.0, pos: [-1.0, 9.5, 3.0], target: [-3.0, -1.5, 0.2], aperture: 7, roll: 0.35, focus: 10.5 },
  { t: 2.5, pos: [-2.5, 7.4, 4.2], target: [-4.0, -0.6, 0.0], aperture: 7, roll: 0.25 },
  { t: 5.0, pos: [-4.5, 4.4, 6.0], target: [-5.0, 0.0, 0.0], aperture: 7.5, roll: 0.12 },
  { t: 8.0, pos: [-8.0, 1.6, 6.8], target: [-5.6, 0.1, 0.0], aperture: 8, roll: 0.0 },
  { t: 11.0, pos: [-12.6, 0.2, 5.0], target: [-6.4, 0.25, 0.0], aperture: 8, roll: -0.08 },
  { t: 14.5, pos: [-18.5, -0.8, 5.2], target: [-9.5, 0.4, 0.0], aperture: 8.5, roll: -0.12 },
  { t: 17.5, pos: [-22.5, -1.3, 4.6], target: [-11.5, 0.5, -0.2], aperture: 8.5, roll: -0.17 },
  { t: 20.0, pos: [-25.0, -1.45, 3.8], target: [-13.0, 0.5, -0.3], aperture: 8.5, roll: -0.2 },
];

const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);

export type CamRig = {
  sample: (t: number) => {
    pos: THREE.Vector3;
    target: THREE.Vector3;
    aperture: number;
    roll: number;
    focus: number | null;
    focusBlend: number;
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
        // Opening focus override fades into "focus on the look-at target".
        focus: keys[0].focus ?? null,
        focusBlend: 1 - Math.max(0, Math.min(1, (t - 0.4) / 2.6)),
      };
    },
  };
};
