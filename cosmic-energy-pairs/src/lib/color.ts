import * as THREE from "three";

/** Hex sRGB colour → linear RGB triple (for shader uniforms in the HDR buffer). */
export const lin = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color(hex); // three converts sRGB hex → linear working space
  return new THREE.Vector3(c.r, c.g, c.b);
};

// JS copy of the composite shader's tone curve (ACES Hill fit, pipeline.ts).
const ACES_IN = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const fit = (x: number) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081);
const aces = (v: number[]) => mul(ACES_OUT, mul(ACES_IN, v).map(fit)).map((x) => Math.min(1, Math.max(0, x)));

/**
 * Background colours: the HDR (pre-tonemap) value that comes out of the ACES
 * curve as the given sRGB hex. Without this the curve's toe crushes deep
 * backgrounds like #03081C to near-black (and invites banding).
 */
export const bg = (hex: string): THREE.Vector3 => {
  const t = lin(hex).toArray();
  const x = [...t];
  for (let i = 0; i < 60; i++) {
    const y = aces(x);
    for (let c = 0; c < 3; c++) x[c] = Math.max(0, x[c] + (t[c] - y[c]) * 1.6);
  }
  return new THREE.Vector3(x[0], x[1], x[2]);
};
