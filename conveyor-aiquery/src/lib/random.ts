// Deterministic PRNG. Every generator is seeded at module level so the same
// seed gives the same layout in every render thread, in any frame order.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

// Integer hash -> [0,1). Used for lattice noise.
export const hash3 = (x: number, y: number, z: number, seed: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Smooth 3D value noise in [-1,1].
export const noise3 = (x: number, y: number, z: number, seed: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const h = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const v = lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), xf), lerp(h(0, 1, 0), h(1, 1, 0), xf), yf),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), xf), lerp(h(0, 1, 1), h(1, 1, 1), xf), yf),
    zf,
  );
  return v * 2 - 1;
};

export const fbm3 = (x: number, y: number, z: number, seed: number, oct = 3) => {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f, seed + i * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
};
