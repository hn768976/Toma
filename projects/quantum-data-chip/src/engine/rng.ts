// Deterministic helpers: every value in the scenes is derived from a seed,
// so any frame renders identically in any tab, in any order.
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

export type Rng = ReturnType<typeof mulberry32>;

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, arr: T[]): T => arr[Math.floor(r() * arr.length)];

// Smooth 1D value noise (deterministic per seed)
export const makeNoise1D = (seed: number) => {
  const r = mulberry32(seed);
  const table = new Float32Array(1024);
  for (let i = 0; i < table.length; i++) table[i] = r();
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % 1024) + 1024) % 1024];
    const b = table[(((i + 1) % 1024) + 1024) % 1024];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
