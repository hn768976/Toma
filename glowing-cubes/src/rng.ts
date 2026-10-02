// Seeded PRNG. Everything random in this project is generated ONCE at module
// load from a fixed seed, so every frame (rendered in any order, on any
// thread, from a cold start) sees exactly the same layout.
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

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];

/** Fisher–Yates shuffle (returns a new array). */
export const shuffle = <T,>(rng: Rng, arr: readonly T[]): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Assign cube types to `n` cubes with the target mix
 * (40% glowing, 30% frosted, 15% clear glass, 15% dark), shuffled.
 */
export type CubeType = "glow" | "frosted" | "glass" | "dark";
export const CUBE_TYPES: CubeType[] = ["glow", "frosted", "glass", "dark"];

export const assignTypes = (rng: Rng, n: number): CubeType[] => {
  const nGlow = Math.round(n * 0.4);
  const nFrost = Math.round(n * 0.3);
  const nGlass = Math.round(n * 0.15);
  const nDark = n - nGlow - nFrost - nGlass;
  const list: CubeType[] = [
    ...Array<CubeType>(nGlow).fill("glow"),
    ...Array<CubeType>(nFrost).fill("frosted"),
    ...Array<CubeType>(nGlass).fill("glass"),
    ...Array<CubeType>(nDark).fill("dark"),
  ];
  return shuffle(rng, list);
};
