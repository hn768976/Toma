// Compact deterministic 3D simplex noise.
//
// Used to displace sphere geometry into organic cell shapes and to drive the
// slow drift of the cells. Seeded from our own RNG so a given seed always
// produces the same surface.

import { mulberry32, type Rng } from "./rng";

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const F3 = 1 / 3;
const G3 = 1 / 6;

export type Noise3D = (x: number, y: number, z: number) => number;

export const createNoise3D = (seed: number): Noise3D => {
  const rng: Rng = mulberry32(seed);

  // Build a shuffled permutation table from the seeded generator.
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  return (x, y, z) => {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;

    const corner = (
      gi: number, cx: number, cy: number, cz: number,
    ) => {
      let t0 = 0.6 - cx * cx - cy * cy - cz * cz;
      if (t0 < 0) return 0;
      t0 *= t0;
      const g = GRAD3[gi];
      return t0 * t0 * (g[0] * cx + g[1] * cy + g[2] * cz);
    };

    n += corner(permMod12[ii + perm[jj + perm[kk]]], x0, y0, z0);
    n += corner(permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1);
    n += corner(permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2);
    n += corner(permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);

    return 32 * n;
  };
};

/** Layered noise, for surfaces that need detail at more than one scale. */
export const fbm = (
  noise: Noise3D,
  x: number,
  y: number,
  z: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
) => {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
};
