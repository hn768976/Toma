/** Deterministic PRNG (mulberry32). Never use Math.random in a render. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

/** Uniformly distributed unit vector, written into `out` (x, y, z). */
export function randomUnit(rng: Rng, out: { x: number; y: number; z: number }) {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  out.x = r * Math.cos(a);
  out.y = r * Math.sin(a);
  out.z = z;
  return out;
}
