/**
 * Seeded 2D Perlin noise plus fBm and a domain-warped variant.
 * The warp is what turns plain fBm into the filamentary structure that reads
 * as a nebula rather than as generic clouds.
 */

import { mulberry32 } from "./rng";

export type Noise2D = (x: number, y: number) => number;

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export const makeNoise2D = (seed: number): Noise2D => {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];

  // 8 unit gradients, indexed by the low 3 bits of the hash.
  const gx = new Float32Array(8);
  const gy = new Float32Array(8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }

  return (x: number, y: number): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = p[p[xi] + yi] & 7;
    const ab = p[p[xi] + yi + 1] & 7;
    const ba = p[p[xi + 1] + yi] & 7;
    const bb = p[p[xi + 1] + yi + 1] & 7;

    const n00 = gx[aa] * xf + gy[aa] * yf;
    const n01 = gx[ab] * xf + gy[ab] * (yf - 1);
    const n10 = gx[ba] * (xf - 1) + gy[ba] * yf;
    const n11 = gx[bb] * (xf - 1) + gy[bb] * (yf - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0); // roughly -0.7 .. 0.7
  };
};

export const fbm = (
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2.05,
  gain = 0.5,
): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm; // roughly -1 .. 1
};

/** Domain-warped fBm (Inigo Quilez's pattern), returns roughly -1 .. 1. */
export const warpedFbm = (
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  warp: number,
): number => {
  const q1 = fbm(noise, x, y, octaves);
  const q2 = fbm(noise, x + 5.2, y + 1.3, octaves);
  const r1 = fbm(noise, x + warp * q1 + 1.7, y + warp * q2 + 9.2, octaves);
  const r2 = fbm(noise, x + warp * q1 + 8.3, y + warp * q2 + 2.8, octaves);
  return fbm(noise, x + warp * r1, y + warp * r2, octaves);
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
