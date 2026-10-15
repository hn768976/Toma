// Deterministic PRNG. Seed at module level only; never call Math.random().
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
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length) % arr.length];
/** Approximate standard normal (sum of uniforms). */
export const gauss = (r: Rng) => (r() + r() + r() + r() - 2) * 1.7320508;

/** Loop length shared by every composition. */
export const LOOP = 600;
export const TAU = Math.PI * 2;
/** Phase in [0, 1) for a frame, exact across the 600-frame loop. */
export const loopPhase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
