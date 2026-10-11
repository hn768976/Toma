import * as THREE from "three";

// Pure geometry for the fibre ribbon (no React), so it can also be checked
// from Node (scripts/check-fibre-smoothness.mjs).

export const RIBBON_HALF = 1.9;
export const SEGMENTS = 1000;

// S-curve centre line (x, y, z). Far end top-left, loops back at the right,
// crosses the frame and comes toward the camera at the lower centre-right.
// Both turns keep a radius well above the ribbon's half-width so the
// offset fibres on the inside of a turn never fold into a cusp.
export const PATH_POINTS: [number, number, number][] = [
  [-60, 6.5, -58],
  [-30, 6.5, -58],
  [-8, 6.2, -57.5],
  [10, 5.4, -55.5],
  [23, 3.8, -50],
  [29, 1.8, -41.5],
  [25, 0.3, -33],
  [12, -0.4, -27.5],
  [-4, -0.4, -22.5],
  [-11.5, -0.7, -17.5],
  [-14.5, -0.9, -11],
  [-12, -1.0, -4.5],
  [-6, -1.1, 0.5],
  [2.2, -1.2, 4.6],
  [4.6, -1.25, 7.0],
];

export const CAMERA_POS = new THREE.Vector3(1.6, 6.2, 13.5);
export const CAMERA_TARGET = new THREE.Vector3(1.6, -3.4, -18);

export type RibbonFrame = {
  path: THREE.CatmullRomCurve3;
  centre: THREE.Vector3[];
  side: THREE.Vector3[];
  up: THREE.Vector3[];
};

// Gaussian smoothing over a polyline of vectors (window in samples).
const smoothVectors = (v: THREE.Vector3[], sigma: number) => {
  const r = Math.ceil(sigma * 3);
  const w: number[] = [];
  for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  return v.map((_, i) => {
    const acc = new THREE.Vector3();
    for (let k = -r; k <= r; k++) {
      const j = Math.min(v.length - 1, Math.max(0, i + k));
      acc.addScaledVector(v[j], w[k + r]);
    }
    return acc;
  });
};

export const buildRibbonFrame = (segments = SEGMENTS, smoothTwist = true): RibbonFrame => {
  const path = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const worldUp = new THREE.Vector3(0, 1, 0);
  const centre: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  let side: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = path.getPointAt(t);
    const tan = path.getTangentAt(t);
    // the band's broad face turns toward the camera (as in a filmed
    // ribbon), mixed with "flat on the ground" so it still lies in space
    const toCam = CAMERA_POS.clone().sub(p).normalize();
    const faceN = worldUp.clone().multiplyScalar(0.35).addScaledVector(toCam, 0.65).normalize();
    const s = new THREE.Vector3().crossVectors(tan, faceN);
    if (s.lengthSq() < 1e-8) s.copy(side[i - 1] ?? new THREE.Vector3(1, 0, 0));
    s.normalize();
    // keep the side vector continuous (no sudden 180-degree flips)
    if (i > 0 && s.dot(side[i - 1]) < 0) s.negate();
    centre.push(p);
    tangents.push(tan);
    side.push(s);
  }
  // The camera-facing rule twists the band quickly where the path turns
  // toward the camera; smooth the twist along the length (~6 world units)
  // so every offset fibre stays a smooth curve.
  const len = path.getLength();
  const sigma = (16 / len) * segments;
  for (let pass = 0; pass < (smoothTwist ? 2 : 0); pass++) {
    side = smoothVectors(side, sigma).map((s, i) => {
      const tan = tangents[i];
      return s.addScaledVector(tan, -s.dot(tan)).normalize();
    });
  }
  const up: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const tan = tangents[i];
    const s = side[i];
    const u = new THREE.Vector3().crossVectors(s, tan).normalize();
    // bank the band a little in the turns so it reads as a twisting ribbon
    const bank = 0.15 * Math.sin(t * Math.PI * 2.0);
    s.applyAxisAngle(tan, bank);
    u.applyAxisAngle(tan, bank);
    up.push(u);
  }
  return { path, centre, side, up };
};
