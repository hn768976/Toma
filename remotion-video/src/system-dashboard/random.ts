// Seeded PRNG. Every value in the composition - table contents, meter
// targets, waveform data, flicker schedules - comes from here, so two
// renders of the same frame are byte-identical.

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

/** One deterministic value in [0, 1) for an integer key. */
export const rand = (key: number): number => mulberry32(Math.floor(key) * 2654435761)();

export const randRange = (key: number, lo: number, hi: number): number =>
  lo + rand(key) * (hi - lo);

export const randInt = (key: number, lo: number, hi: number): number =>
  Math.floor(randRange(key, lo, hi + 1 - 1e-9));

export const pick = <T,>(key: number, list: readonly T[]): T =>
  list[Math.floor(rand(key) * list.length) % list.length];

/** Array of `n` values from a single stream - cheaper than n rand() calls. */
export const stream = (seed: number, n: number, lo = 0, hi = 1): number[] => {
  const r = mulberry32(seed);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = lo + r() * (hi - lo);
  return out;
};
