export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const irange = (rng: Rng, lo: number, hi: number) =>
  Math.floor(range(rng, lo, hi + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];
export const chance = (rng: Rng, p: number) => rng() < p;

// Smooth value noise on a lattice; sample(u, v) with u, v in [0, 1] -> [0, 1].
export const makeValueNoise = (rng: Rng, cellsX: number, cellsY: number) => {
  const gw = cellsX + 2;
  const gh = cellsY + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return (u: number, v: number) => {
    const x = u * cellsX;
    const y = v * cellsY;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const i0 = yi * gw + xi;
    const a = grid[i0];
    const b = grid[i0 + 1];
    const c = grid[i0 + gw];
    const d = grid[i0 + gw + 1];
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
  };
};

export const makeFbm = (rng: Rng, baseX: number, baseY: number, octaves: number) => {
  const layers = Array.from({ length: octaves }, (_, o) =>
    makeValueNoise(rng, Math.ceil(baseX * 2 ** o), Math.ceil(baseY * 2 ** o)),
  );
  return (u: number, v: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < layers.length; o++) {
      sum += layers[o](u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
};
