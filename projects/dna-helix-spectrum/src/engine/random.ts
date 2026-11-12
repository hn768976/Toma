// Deterministic, seedable PRNG (mulberry32) so every render is identical.
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

export const hsl = (h: number, s: number, l: number): [number, number, number] => {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};
