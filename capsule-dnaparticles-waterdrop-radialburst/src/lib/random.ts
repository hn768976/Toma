// Deterministic PRNG (mulberry32). Every random value in this project comes
// from a generator seeded at module level, never from Math.random(), so a
// frame rendered on its own, out of order or on another thread is identical.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Approximate standard normal from a uniform generator (sum of 4).
export const gauss = (rand: () => number) =>
  (rand() + rand() + rand() + rand() - 2) * 1.7320508;

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// sRGB -> linear, used when colours go into linear-light pipelines.
export const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
