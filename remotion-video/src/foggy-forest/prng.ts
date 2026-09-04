/**
 * Deterministic PRNG. Every placement, scale, flip and phase in the scene is
 * drawn from a seeded stream, so a given frame renders identically on every
 * machine and there is no state carried between frames.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A looping oscillator: `cycles` must be an integer so the value at
 * frame `duration` is identical to the value at frame 0.
 */
export const loopWave = (
  frame: number,
  duration: number,
  cycles: number,
  phase = 0,
) => Math.sin(2 * Math.PI * (cycles * (frame / duration) + phase));
