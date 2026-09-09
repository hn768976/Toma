// Deterministic PRNG helpers. Remotion renders frames out of order across
// threads, so nothing in this project may call Math.random() at render time:
// every particle property is derived from a fixed seed instead.

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Turns a string into a 32-bit seed so palettes/compositions can each own a
// stable, distinct particle field.
export const hashSeed = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Sum of three uniforms, centred on 0 and roughly normal: gives the ring a
// dense core that thins out smoothly inward and outward.
export const gaussianish = (rand: () => number): number =>
  (rand() + rand() + rand() - 1.5) / 1.5;
