// Deterministic randomness. Nothing at render time may call Math.random():
// every generator is seeded from a composition id or a fixed constant.

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

// FNV-1a: turns a composition id into a 31-bit seed.
export const hashString = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff || 1;
};

export type Rng = () => number;
export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]) => arr[Math.floor(rng() * arr.length) % arr.length];

// Rough.js boil: one new seed every 5 frames, wrapped to the loop length so
// frame 0 and frame `loop` draw identically.
export const boilSeed = (base: number, frame: number, loop: number) =>
  (base % 1_000_000) + 1 + (Math.floor(frame / 5) % Math.max(1, Math.round(loop / 5)));

// Sketchy elements move "on twos": positions only update every 2 frames.
export const onTwos = (frame: number) => frame - (frame % 2);
