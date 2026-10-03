// JS port of three.js' AgXToneMapping (ShaderChunk/tonemapping_pars_fragment)
// plus its exact step-by-step inverse. The palette is specified as display
// (sRGB) hex colours; inverting AgX tells us which linear scene value lands on
// that hex after tonemapping, so the pastels come out exactly as specified.

type V3 = [number, number, number];
type M3 = [V3, V3, V3]; // column-major, like GLSL mat3(col0, col1, col2)

const mul = (m: M3, v: V3): V3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];

const mulMM = (a: M3, b: M3): M3 => [mul(a, b[0]), mul(a, b[1]), mul(a, b[2])];

const inverse = (m: M3): M3 => {
  // rows of the matrix = r[i][j] = m[j][i]
  const [a, d, g] = m[0];
  const [b, e, h] = m[1];
  const [c, f, i] = m[2];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const inv = [
    [A, -(b * i - c * h), b * f - c * e],
    [B, a * i - c * g, -(a * f - c * d)],
    [C, -(a * h - b * g), a * e - b * d],
  ].map((row) => row.map((x) => x / det));
  // inv is row-major; convert to column-major
  return [
    [inv[0][0], inv[1][0], inv[2][0]],
    [inv[0][1], inv[1][1], inv[2][1]],
    [inv[0][2], inv[1][2], inv[2][2]],
  ];
};

const SRGB_TO_REC2020: M3 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const REC2020_TO_SRGB: M3 = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const INSET: M3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const OUTSET: M3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const MIN_EV = -12.47393;
const MAX_EV = 4.026069;

const sigmoid = (x: number) => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
};

const sigmoidInverse = (y: number) => {
  // sigmoid is monotonic on [0,1]; bisection is exact enough
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (sigmoid(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// AgX "look" (slope/power = 1, saturation only), applied in the sigmoid's
// output space exactly like the reference AgX look transform. A little extra
// saturation lets the saturated coral/aqua edge colours survive AgX's
// desaturation of bright values. Must match AGX_LOOK_SATURATION in shaders.ts.
export const AGX_LOOK_SATURATION = 1.6;
const LUMA: V3 = [0.2126, 0.7152, 0.0722];
const look = (v: V3, sat: number): V3 => {
  const l = v[0] * LUMA[0] + v[1] * LUMA[1] + v[2] * LUMA[2];
  return v.map((x) => l + sat * (x - l)) as V3;
};

export const agx = (c: V3): V3 => {
  let v = mul(INSET, mul(SRGB_TO_REC2020, c));
  v = v.map((x) =>
    clamp01((Math.log2(Math.max(x, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)),
  ) as V3;
  v = v.map(sigmoid) as V3;
  v = look(v, AGX_LOOK_SATURATION);
  v = mul(OUTSET, v);
  v = v.map((x) => Math.pow(Math.max(0, x), 2.2)) as V3;
  v = mul(REC2020_TO_SRGB, v);
  return v.map(clamp01) as V3;
};

const IN_TO_LOG = mulMM(INSET, SRGB_TO_REC2020);
const LOG_TO_IN = inverse(IN_TO_LOG);
const OUTSET_INV = inverse(OUTSET);
const R2S_INV = inverse(REC2020_TO_SRGB);

/** Linear scene colour that AgX maps onto the given linear-sRGB display colour. */
export const agxInverse = (target: V3): V3 => {
  let v = mul(R2S_INV, target);
  v = v.map((x) => Math.pow(Math.max(0, x), 1 / 2.2)) as V3;
  v = mul(OUTSET_INV, v);
  v = look(v, 1 / AGX_LOOK_SATURATION);
  v = v.map((x) => sigmoidInverse(x)) as V3;
  v = v.map((x) => Math.pow(2, x * (MAX_EV - MIN_EV) + MIN_EV)) as V3;
  v = mul(LOG_TO_IN, v);
  return v.map((x) => Math.max(0, x)) as V3;
};

export const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

export const hexToLinear = (hex: string): V3 => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) =>
    srgbToLinear(x / 255),
  ) as V3;
};

/** Scene-linear input that renders as `hex` after AgX + sRGB output. */
export const sceneColorForDisplayHex = (hex: string): V3 =>
  agxInverse(hexToLinear(hex));
