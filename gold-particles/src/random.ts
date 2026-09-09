// A tiny deterministic PRNG (mulberry32). Every particle property —
// seed position, depth, speed, wander phases, sparkle schedule — is
// derived from its index through this, never from Math.random(), because
// Remotion renders frames out of order across threads and anything that
// isn't a pure function of (particleIndex, frame) would flicker and
// break the loop.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Uniform in [min, max).
export const range = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);

// Picks an element of `values` uniformly.
export const pick = <T,>(rand: () => number, values: readonly T[]): T =>
  values[Math.min(values.length - 1, Math.floor(rand() * values.length))];

export const clamp = (value: number, min = 0, max = 1) =>
  value < min ? min : value > max ? max : value;
