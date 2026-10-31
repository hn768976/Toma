import { LedPalette, Vec3 } from "./palettes";

/**
 * CPU-side per-lamp flicker + colour, evaluated once per frame and sent
 * to the shader as `uLamp[190]` (vec4: level, r, g, b).  Doing this on the
 * CPU instead of per pixel removes ~75 noise evaluations per pixel.
 *
 * The hash/noise functions mirror the GLSL ones in ledWallShader.ts.
 */

const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

const hash11 = (p0: number) => {
  let p = fract(p0 * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
};

const hash21 = (x: number, y: number) => {
  let a = fract(x * 0.1031);
  let b = fract(y * 0.1031);
  let c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fract((a + b) * c);
};

const noise1 = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return mix(hash11(i), hash11(i + 1), u);
};

const noise2 = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return mix(
    mix(hash21(ix, iy), hash21(ix + 1, iy), ux),
    mix(hash21(ix, iy + 1), hash21(ix + 1, iy + 1), ux),
    uy,
  );
};

export const COLS = 19; // i = -1 .. 17
export const ROWS = 10; // j = 0 .. 9

const colX = (i: number) => (i <= -1 ? 14 : i >= 17 ? 749 : 41 + 42.625 * i);

/** Flicker level in [0,1]. */
const lightLevel = (i: number, j: number, f: number) => {
  const h = hash21(i * 1.37 + 0.5, j * 1.37 + 0.5);
  // ~25-frame on/off period, random per lamp (no travelling chase).
  const t = f / 8;
  const n = noise1(t + h * 517) * 0.66 + noise1(t * 1.7 + h * 91) * 0.34;
  // Weak, non-travelling neighbour correlation (a morphing patch pattern).
  const patch = noise2(i * 0.42 + j * 7.3, f / 11 + j * 3.1);
  // Jittery global flicker, decorrelating within ~6 frames.
  const g = noise1(f / 2.5 + 300);
  const v = n * 0.82 + patch * 0.26 + (g - 0.5) * 0.14 + 0.0;
  return smoothstep(0.18, 0.82, v);
};

const mix3 = (a: Vec3, b: Vec3, t: number): [number, number, number] => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

const lightColor = (pal: LedPalette, i: number, j: number, f: number) => {
  const gx = colX(i) / 768;
  const h = hash21(i + 3.1, j + 3.1);
  const base = mix3(
    pal.uLightLeft,
    pal.uLightRight,
    smoothstep(0, 0.45, gx + (h - 0.5) * 0.3),
  );
  const accentRow = j % 3 === 0 ? 1 : 0; // rows 0, 3, 6, 9
  const accent =
    accentRow * 0.75 * (1 - gx * 0.35) +
    (hash21(i + 11, j + 11) >= 0.86 ? 0.45 : 0) +
    (noise1(f / 9 + h * 50) - 0.5) * 0.35;
  return mix3(base, pal.uLightAccent, clamp01(accent));
};

export const lampState = (pal: LedPalette, frame: number): Float32Array => {
  const out = new Float32Array(COLS * ROWS * 4);
  for (let i = -1; i <= 17; i++) {
    for (let j = 0; j < ROWS; j++) {
      const k = ((i + 1) * ROWS + j) * 4;
      const c = lightColor(pal, i, j, frame);
      out[k] = lightLevel(i, j, frame);
      out[k + 1] = c[0];
      out[k + 2] = c[1];
      out[k + 3] = c[2];
    }
  }
  return out;
};
