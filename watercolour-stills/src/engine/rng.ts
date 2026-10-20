// Seeded randomness for layout geometry. Nothing here touches Math.random()
// or the clock, so a given seed always produces the same sheet.

export type Rng = {
  (): number;
  range: (a: number, b: number) => number;
  int: (a: number, b: number) => number;
  gauss: (mean?: number, sd?: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  chance: (p: number) => boolean;
  fork: (salt: number) => Rng;
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const makeRng = (seed: number): Rng => {
  const next = mulberry32(seed);
  const r = (() => next()) as Rng;
  r.range = (a, b) => a + (b - a) * next();
  r.int = (a, b) => Math.floor(a + (b - a) * next());
  r.gauss = (mean = 0, sd = 1) => {
    const u = 1 - next();
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  r.fork = (salt) => makeRng((seed * 2654435761 + salt * 40503 + 12345) >>> 0);
  return r;
};

// Seeded 1D/2D value noise with smooth interpolation, used to deform shape
// outlines so that no edge is geometric.
export const makeNoise = (seed: number) => {
  const perm = new Uint16Array(512);
  const vals = new Float32Array(256);
  const r = makeRng(seed ^ 0x9e3779b9);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = r() * 2 - 1;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const h = (i: number, j: number) => vals[perm[(perm[(xi + i) & 255] + yi + j) & 255]];
    const u = fade(xf);
    const v = fade(yf);
    const a = h(0, 0) + (h(1, 0) - h(0, 0)) * u;
    const b = h(0, 1) + (h(1, 1) - h(0, 1)) * u;
    return a + (b - a) * v;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      s += amp * n2(x * f + o * 17.3, y * f - o * 9.1);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
  return { n2, fbm };
};
export type Noise = ReturnType<typeof makeNoise>;
