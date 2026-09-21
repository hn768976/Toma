/**
 * Seeded 3D Perlin noise, used for soma surface displacement.
 *
 * Built from a seeded permutation table so a given look always produces the
 * same surface. Classic Perlin rather than simplex: the gradient artefacts
 * are invisible under an emissive material and the code is a third the size.
 */

import type { Rng } from "./random";

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const grad = (hash: number, x: number, y: number, z: number) => {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

export type Noise3D = (x: number, y: number, z: number) => number;

/** Returns a noise function in roughly [-1, 1]. */
export const makeNoise3D = (rng: Rng): Noise3D => {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  return (x, y, z) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const a = p[xi] + yi;
    const aa = p[a] + zi;
    const ab = p[a + 1] + zi;
    const b = p[xi + 1] + yi;
    const ba = p[b] + zi;
    const bb = p[b + 1] + zi;

    return lerp(
      lerp(
        lerp(grad(p[aa], xf, yf, zf), grad(p[ba], xf - 1, yf, zf), u),
        lerp(grad(p[ab], xf, yf - 1, zf), grad(p[bb], xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(
          grad(p[aa + 1], xf, yf, zf - 1),
          grad(p[ba + 1], xf - 1, yf, zf - 1),
          u,
        ),
        lerp(
          grad(p[ab + 1], xf, yf - 1, zf - 1),
          grad(p[bb + 1], xf - 1, yf - 1, zf - 1),
          u,
        ),
        v,
      ),
      w,
    );
  };
};

/** Fractal sum of `octaves` noise layers. */
export const fbm = (
  noise: Noise3D,
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity = 2.0,
  gain = 0.5,
) => {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
};
