import * as THREE from "three";

// JS port of three.js' ACESFilmicToneMapping, used to find the linear
// background radiance that lands on an exact sRGB colour after tone mapping
// (so the flat backdrop matches the reference swatch precisely).
const IN = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
const mul = (m: number[][], v: number[]) =>
  m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const fit = (x: number) =>
  (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081);

export const acesFilmic = (c: number[], exposure = 1) => {
  const v = mul(IN, c.map((x) => (x * exposure) / 0.6));
  return mul(OUT, v.map(fit)).map((x) => Math.min(1, Math.max(0, x)));
};

// Linear-sRGB radiance that tone-maps (at `exposure`) to the given sRGB hex.
export const radianceForDisplayColor = (hex: string, exposure = 1) => {
  const target = new THREE.Color(hex); // three converts hex to linear sRGB
  const want = [target.r, target.g, target.b];
  let x = [...want];
  for (let i = 0; i < 200; i++) {
    const y = acesFilmic(x, exposure);
    x = x.map((xi, k) => Math.max(0, xi + (want[k] - y[k]) * 0.8));
  }
  return new THREE.Color(x[0], x[1], x[2]);
};
