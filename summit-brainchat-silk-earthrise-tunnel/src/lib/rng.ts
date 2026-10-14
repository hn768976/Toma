// Deterministic randomness. Every generator is seeded at module level or at
// scene-build time; nothing here is ever called with Math.random().

export const LOOP = 600; // 20 s at 30 fps; every composition loops on this
export const TAU = Math.PI * 2;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fract = (x: number) => x - Math.floor(x);

/** Phase in [0,1) of something that completes `cycles` whole cycles per loop. */
export const loopPhase = (frame: number, cycles: number, offset = 0) =>
  fract((frame * cycles) / LOOP + offset);

/** Closed oscillation: whole number of cycles per loop, so frame 600 == frame 0. */
export const osc = (frame: number, cycles = 1, phase = 0) =>
  Math.sin(TAU * ((frame * cycles) / LOOP + phase));
export const oscC = (frame: number, cycles = 1, phase = 0) =>
  Math.cos(TAU * ((frame * cycles) / LOOP + phase));

export const easeOutBack = (x: number, s = 1.9) => {
  const t = x - 1;
  return 1 + t * t * ((s + 1) * t + s);
};
