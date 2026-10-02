import { hexToRgb } from './math';

// JS mirror of the final pass's tone curve (Hill ACES fit + sRGB), used to
// pick linear scene values for unlit surfaces (sky, floor) so they land on a
// chosen display colour after tonemapping.
type V3 = [number, number, number];
const mul = (m: number[], v: V3): V3 => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];
const ACES_IN = [0.59719, 0.076, 0.0284, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777];
const ACES_OUT = [1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602];
const fit = (x: number) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const oetf = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export const toneForward = (lin: V3, exposure: number): V3 => {
  const a = mul(ACES_IN, [lin[0] * exposure, lin[1] * exposure, lin[2] * exposure]);
  const b = mul(ACES_OUT, [fit(a[0]), fit(a[1]), fit(a[2])]);
  return [oetf(clamp01(b[0])), oetf(clamp01(b[1])), oetf(clamp01(b[2]))];
};

/** Linear scene colour that displays as `hex` after exposure + ACES + sRGB. */
export const displayToScene = (hex: string, exposure: number): V3 => {
  const target = hexToRgb(hex);
  let x: V3 = [0.3, 0.3, 0.3];
  for (let it = 0; it < 200; it++) {
    const y = toneForward(x, exposure);
    x = [
      Math.max(0, x[0] + (target[0] - y[0]) * 0.8 * (x[0] + 0.05)),
      Math.max(0, x[1] + (target[1] - y[1]) * 0.8 * (x[1] + 0.05)),
      Math.max(0, x[2] + (target[2] - y[2]) * 0.8 * (x[2] + 0.05)),
    ];
  }
  return x;
};
