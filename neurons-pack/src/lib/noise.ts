// Seeded 3D simplex noise (after Stefan Gustavson's public-domain
// reference implementation) and a curl-noise helper, for CPU-side
// generation (thread paths, neuron branching).
import { mulberry32 } from "./random";

const G3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

export const makeNoise3 = (seed: number) => {
  const rng = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const F3 = 1 / 3;
  const G = 1 / 6;
  return (xin: number, yin: number, zin: number) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
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
    const x1 = x0 - i1 + G, y1 = y0 - j1 + G, z1 = z0 - k1 + G;
    const x2 = x0 - i2 + 2 * G, y2 = y0 - j2 + 2 * G, z2 = z0 - k2 + 2 * G;
    const x3 = x0 - 1 + 3 * G, y3 = y0 - 1 + 3 * G, z3 = z0 - 1 + 3 * G;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const corner = (gi: number, x: number, y: number, z: number) => {
      let tt = 0.6 - x * x - y * y - z * z;
      if (tt < 0) return 0;
      const g = G3[gi % 12];
      tt *= tt;
      return tt * tt * (g[0] * x + g[1] * y + g[2] * z);
    };
    const n0 = corner(perm[ii + perm[jj + perm[kk]]], x0, y0, z0);
    const n1 = corner(perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1);
    const n2 = corner(perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2);
    const n3 = corner(perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
    return 32 * (n0 + n1 + n2 + n3);
  };
};

export type Noise3 = ReturnType<typeof makeNoise3>;

/** 2D curl of a scalar potential n(x, y, z): divergence-free flow in xy. */
export const curl2 = (n: Noise3, x: number, y: number, z: number, e = 0.01) => {
  const dx = (n(x + e, y, z) - n(x - e, y, z)) / (2 * e);
  const dy = (n(x, y + e, z) - n(x, y - e, z)) / (2 * e);
  return [dy, -dx] as const;
};
