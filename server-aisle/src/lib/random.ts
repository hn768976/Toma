// Seeded randomness. Every generator here is created at module level (or from
// a fixed seed), so scene layouts are identical in every render thread.

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
export const irange = (rng: Rng, a: number, b: number) =>
  Math.floor(a + (b - a + 1) * rng());
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];

/** Integer hash -> [0,1). Used for flicker buckets (never Math.random). */
export const hash01 = (n: number) => {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/** Positive modulo for integers and floats. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Periods that divide 600 frames, for LEDs and screen animations. */
export const LOOP_PERIODS = [50, 60, 75, 100, 120, 150, 200] as const;

/**
 * Blink / breathe value for an LED at `frame`, exact over any 600-frame loop
 * because `period` divides 600 and the phase is an integer frame offset.
 */
export const ledValue = (
  frame: number,
  period: number,
  phase: number,
  mode: "blink" | "breathe",
  duty = 0.5,
) => {
  const p = mod(frame + phase, period) / period;
  if (mode === "breathe") return 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(2 * Math.PI * p));
  // Short soft edges (2 frames) so blinks read as deliberate, not as noise.
  const edge = 1.5 / period;
  const on = smooth(0, edge, p) * (1 - smooth(duty, duty + edge, p));
  return 0.08 + 0.92 * on;
};

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
