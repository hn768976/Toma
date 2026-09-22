import * as THREE from "three";

/**
 * A mirror of three's AgXToneMapping, plus a numeric inverse.
 *
 * Why AgX and not ACES: the backdrops here are mid-saturation blues, and every
 * one of look 3's frames is mostly backdrop. ACES pushes those blues toward
 * the primary — #4a9fd8 comes out #009ddd, visibly wrong against the
 * reference — while AgX reproduces them exactly. AgX also maps 0 to 0, which
 * look 2's overlay depends on.
 *
 * The inverse exists so unlit backdrops can be authored as the colour they
 * should LOOK like in the finished file. Tone mapping sits between the shader
 * and the encode, so an authored hex would otherwise land somewhere else.
 * Build time only.
 */

type Mat3 = readonly (readonly number[])[];

const mul = (m: Mat3, v: number[]): number[] => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

// Row-major transposes of the column-major mat3 literals in three's
// tonemapping_pars_fragment chunk.
const SRGB_TO_REC2020: Mat3 = [
  [0.6274, 0.3293, 0.0433],
  [0.0691, 0.9195, 0.088],
  [0.0164, 0.0113, 0.8956],
];
const REC2020_TO_SRGB: Mat3 = [
  [1.6605, -0.5876, -0.0728],
  [-0.1246, 1.1329, -0.1006],
  [-0.0182, -0.0083, 1.1187],
];
const AGX_INSET: Mat3 = [
  [0.856627153315983, 0.0951212405381588, 0.0482516061458583],
  [0.137318972929847, 0.761241990602591, 0.101439036467562],
  [0.11189821299995, 0.0767994186031903, 0.811302368396859],
];
const AGX_OUTSET: Mat3 = [
  [1.1271005818144368, -0.11060664309660323, -0.016493938717834573],
  [-0.1413297634984383, 1.157823702216272, -0.016493938717834257],
  [-0.14132976349843826, -0.11060664309660294, 1.2519364065950405],
];

const AGX_MIN_EV = -12.47393;
const AGX_MAX_EV = 4.026069;

const contrastApprox = (x: number): number => {
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Scene-linear sRGB in, tone-mapped linear-sRGB display colour out. */
export const agx = (rgb: readonly number[], exposure = 1): number[] => {
  let c = mul(AGX_INSET, mul(SRGB_TO_REC2020, rgb.map((v) => v * exposure)));
  c = c.map((v) =>
    contrastApprox(clamp01((Math.log2(Math.max(v, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV))),
  );
  c = mul(REC2020_TO_SRGB, mul(AGX_OUTSET, c).map((v) => Math.pow(Math.max(0, v), 2.2)));
  return c.map(clamp01);
};

/** Gaussian elimination with partial pivoting; null if singular. */
const solve3 = (m: number[][], b: number[]): number[] | null => {
  const a = m.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[piv][col])) piv = row;
    }
    if (Math.abs(a[piv][col]) < 1e-14) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const f = a[row][col] / a[col][col];
      for (let k = col; k < 4; k++) a[row][k] -= f * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
};

/**
 * Scene-linear colour that tone-maps to `target`.
 *
 * Newton's method in log space, so the estimate can never go negative and the
 * solver never gets pinned against zero. Deeply saturated targets are outside
 * what AgX can produce at all; `error` reports how far short it fell, in
 * linear units, so an unreachable backdrop shows up at build time instead of
 * in the render.
 */
export const preToneMapSolve = (
  hex: string,
  exposure = 1,
): { linear: THREE.Color; error: number } => {
  const target = srgbHexToLinear(hex);
  if (target.every((c) => c <= 0)) {
    return { linear: new THREE.Color(0, 0, 0), error: 0 };
  }

  let u = target.map((c) => Math.log(Math.max(c, 1e-5)));
  const residual = (v: number[]) => {
    const got = agx(v.map(Math.exp), exposure);
    return [got[0] - target[0], got[1] - target[1], got[2] - target[2]];
  };

  let best = [...u];
  let bestErr = Infinity;

  for (let iter = 0; iter < 300; iter++) {
    const r = residual(u);
    const err = Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]));
    if (err < bestErr) {
      bestErr = err;
      best = [...u];
    }
    if (err < 1e-9) break;

    const h = 1e-5;
    const J: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let c = 0; c < 3; c++) {
      const up = [...u];
      up[c] += h;
      const ru = residual(up);
      for (let row = 0; row < 3; row++) J[row][c] = (ru[row] - r[row]) / h;
    }

    const step = solve3(J, r);
    if (!step) break;

    let damping = 1;
    let moved = false;
    for (let t = 0; t < 30; t++) {
      const next = u.map((x, i) => x - step[i] * damping);
      const rn = residual(next);
      if (Math.max(Math.abs(rn[0]), Math.abs(rn[1]), Math.abs(rn[2])) < err) {
        u = next;
        moved = true;
        break;
      }
      damping *= 0.5;
    }
    if (!moved) break;
  }

  const lin = best.map(Math.exp);
  return { linear: new THREE.Color(lin[0], lin[1], lin[2]), error: bestErr };
};

export const preToneMap = (hex: string, exposure = 1): THREE.Color =>
  preToneMapSolve(hex, exposure).linear;

/**
 * sRGB hex to scene-linear, done explicitly.
 *
 * Not via `new THREE.Color(hex)`: with colour management on — which is the
 * default, and what react-three-fiber sets — that constructor ALREADY decodes
 * sRGB, so a following `.convertSRGBToLinear()` decodes twice and every
 * authored colour comes out dark and oversaturated. Doing the transfer
 * function here means the result does not depend on a global flag.
 */
const srgbHexToLinear = (hex: string): number[] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};
