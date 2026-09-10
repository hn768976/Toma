// Deterministic hashing and a value-noise field whose time axis wraps.
//
// Nothing here may depend on Math.random(), Date.now() or state carried
// between frames: Remotion renders frames out of order across worker threads,
// so every value has to be a pure function of (col, row, frame).

const hash3i = (x: number, y: number, z: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d);
  h = (h ^ Math.imul(y | 0, 0x165667b1)) | 0;
  h = (h ^ Math.imul(z | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Stable [0, 1) value for a (col, row, salt) triple. */
export const hash01 = (x: number, y: number, salt: number) =>
  hash3i(x, y, salt) / 4294967296;

// Quintic fade, so the interpolated field has a continuous first derivative
// and the patches do not show the lattice as faint square creases.
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 3D value noise in [0, 1). The Z axis is a lattice of `zPeriod` cells that
 * wraps, so sampling z from 0 to zPeriod over the loop returns exactly to the
 * starting field — this is what lets the clusters morph and still loop.
 */
export const loopNoise3 = (
  x: number,
  y: number,
  z: number,
  zPeriod: number,
): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);

  const z0 = ((iz % zPeriod) + zPeriod) % zPeriod;
  const z1 = (z0 + 1) % zPeriod;

  const c000 = hash3i(ix, iy, z0) / 4294967296;
  const c100 = hash3i(ix + 1, iy, z0) / 4294967296;
  const c010 = hash3i(ix, iy + 1, z0) / 4294967296;
  const c110 = hash3i(ix + 1, iy + 1, z0) / 4294967296;
  const c001 = hash3i(ix, iy, z1) / 4294967296;
  const c101 = hash3i(ix + 1, iy, z1) / 4294967296;
  const c011 = hash3i(ix, iy + 1, z1) / 4294967296;
  const c111 = hash3i(ix + 1, iy + 1, z1) / 4294967296;

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
};

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
