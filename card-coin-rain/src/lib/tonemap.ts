import { Color } from "three";

/**
 * JS mirror of three.js' ACESFilmicToneMapping (r180,
 * tonemapping_pars_fragment.glsl), plus its exact inverse. Used so the
 * backdrop shader can be fed the scene-linear colour that comes out of the
 * tonemapper as the exact display colour we asked for.
 */
// GLSL mat3(...) takes columns. Stored here as rows for M * v.
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

type V3 = [number, number, number];
const mul = (m: number[][], v: V3): V3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const inv3 = (m: number[][]) => {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
};
const IN_INV = inv3(IN);
const OUT_INV = inv3(OUT);

const fit = (v: number) =>
  (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
const fitInv = (y: number) => {
  // (1 - 0.983729y) v^2 + (0.0245786 - 0.432951y) v - (0.000090537 + 0.238081y) = 0
  const a = 1 - 0.983729 * y;
  const b = 0.0245786 - 0.432951 * y;
  const c = -(0.000090537 + 0.238081 * y);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
};

export const acesFilmic = (lin: V3, exposure = 1): V3 => {
  const s = exposure / 0.6;
  const v = mul(IN, [lin[0] * s, lin[1] * s, lin[2] * s]);
  const o = mul(OUT, [fit(v[0]), fit(v[1]), fit(v[2])]);
  return o.map((x) => Math.min(1, Math.max(0, x))) as V3;
};

export const acesFilmicInverse = (display: V3, exposure = 1): V3 => {
  const o = mul(OUT_INV, display);
  const v = mul(IN_INV, [fitInv(o[0]), fitInv(o[1]), fitInv(o[2])]);
  const s = 0.6 / exposure;
  return [v[0] * s, v[1] * s, v[2] * s];
};

/** sRGB hex we want on screen -> scene-linear value to render. */
export const preTonemapColor = (hex: string, exposure = 1) => {
  const c = new Color(hex); // linear (display-referred) after sRGB decode
  const v = acesFilmicInverse([c.r, c.g, c.b], exposure);
  return new Color(v[0], v[1], v[2]);
};
