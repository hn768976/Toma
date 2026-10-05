// Seeded PRNG. Every generator in this project is seeded at module level so
// geometry is identical in every render thread and every cold start.
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

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const irange = (r: Rng, a: number, b: number) =>
  Math.floor(a + (b - a + 1) * r());
export const pick = <T>(r: Rng, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length)];

// sRGB hex -> linear RGB triple (shaders light in linear space and the final
// pass encodes back to sRGB).
export const lin = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
};
