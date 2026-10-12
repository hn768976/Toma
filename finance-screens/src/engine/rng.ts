// Deterministic randomness. Nothing on screen may use Math.random():
// every value comes from a seeded generator built at module level or from
// a pure hash of (seed, index).

export const LOOP = 600; // 20 s at 30 fps; every motion is periodic in this

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

// Integer hash of up to three ints -> [0, 1)
export const hash = (a: number, b = 0, c = 0): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x9e3779b1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Phase in [0, 1) of the 20 s loop. Motion uses sin/cos of whole multiples
// of this, so frame 600 reproduces frame 0 exactly.
export const loopPhase = (frame: number) => frame / LOOP;

// A value that changes on a schedule dividing 600 frames: returns a stable
// [0,1) value per step, and step 600/period wraps to step 0.
// Each ticker gets a seeded phase offset inside its period, so the schedules
// don't all switch on the same frame (which would flash at the loop point).
export const ticker = (frame: number, period: number, seed: number) => {
  const steps = Math.round(LOOP / period);
  const offset = Math.floor(hash(seed, 31, 17) * period);
  const step = (((Math.floor((frame + offset) / period) % steps) + steps) % steps);
  return hash(seed, step, 7);
};
