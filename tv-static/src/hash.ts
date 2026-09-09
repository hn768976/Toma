/**
 * Deterministic integer hash. Every pixel in every frame is a pure function
 * of (x, y, frame % durationInFrames) so Remotion can render frames out of
 * order across threads, and frame 300 is bit-identical to frame 0.
 */
export const hash01 = (x: number, y: number, z: number): number => {
  let h =
    (Math.imul(x | 0, 374761393) +
      Math.imul(y | 0, 668265263) +
      Math.imul(z | 0, -2048144789)) |
    0;
  h = Math.imul(h ^ (h >>> 13), -1640531527);
  h = Math.imul(h ^ (h >>> 15), -2048144789);
  h ^= h >>> 16;
  return (h >>> 0) * 2.3283064365386963e-10;
};

const wrap = (a: number, p: number): number => {
  const m = a % p;
  return m < 0 ? m + p : m;
};

const fade = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise on a lattice that repeats every (px, py, pz) cells. The
 * periodicity on the z (time) axis is what makes the drifting tonal masses
 * return exactly to their starting state at the end of the loop.
 */
export const periodicNoise3 = (
  x: number,
  y: number,
  z: number,
  px: number,
  py: number,
  pz: number,
  seed: number,
): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const ux = fade(x - ix);
  const uy = fade(y - iy);
  const uz = fade(z - iz);

  const x0 = wrap(ix, px);
  const x1 = wrap(ix + 1, px);
  const y0 = wrap(iy, py);
  const y1 = wrap(iy + 1, py);
  const z0 = wrap(iz, pz);
  const z1 = wrap(iz + 1, pz);

  // Fold the two independent axes we cannot pass separately into the hash's
  // third argument; the avalanche keeps neighbouring cells uncorrelated.
  const c = (xa: number, ya: number, za: number) =>
    hash01(xa, ya, za * 131 + seed * 7919);

  const n000 = c(x0, y0, z0);
  const n100 = c(x1, y0, z0);
  const n010 = c(x0, y1, z0);
  const n110 = c(x1, y1, z0);
  const n001 = c(x0, y0, z1);
  const n101 = c(x1, y0, z1);
  const n011 = c(x0, y1, z1);
  const n111 = c(x1, y1, z1);

  const a = n000 + (n100 - n000) * ux;
  const b = n010 + (n110 - n010) * ux;
  const cc = n001 + (n101 - n001) * ux;
  const d = n011 + (n111 - n011) * ux;

  const e = a + (b - a) * uy;
  const f = cc + (d - cc) * uy;

  return e + (f - e) * uz;
};
