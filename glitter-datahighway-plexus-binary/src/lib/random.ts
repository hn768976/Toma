// Deterministic randomness. Everything is seeded at module level; nothing on
// screen may come from Math.random(), Date.now() or a clock.

export const LOOP = 600; // frames per seamless loop (20s at 30fps)

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

// Integer hash -> [0,1). Used for per-id, per-bucket choices (holds, swaps).
export const hash2 = (a: number, b: number) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;

/** sRGB hex -> linear-light RGB triple. */
export const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
};

/** Weighted pick from [weight, value] pairs with a uniform u in [0,1). */
export const pickWeighted = <T,>(u: number, table: [number, T][]): T => {
  const total = table.reduce((s, [w]) => s + w, 0);
  let x = u * total;
  for (const [w, v] of table) {
    if (x < w) return v;
    x -= w;
  }
  return table[table.length - 1][1];
};
