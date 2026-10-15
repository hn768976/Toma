// Deterministic randomness. Nothing here reads a clock or Math.random().

/** mulberry32 PRNG. Seed it at module level (or from a fixed number) only. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash → [0, 1). Same input, same output, on every thread. */
export function hash01(...ns: number[]): number {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** sRGB hex → linear-light RGB (shaders mix in linear, encode at the end). */
export function hexToLinear(hex: string): [number, number, number] {
  return hexToRgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
}
