// Deterministic, stateless pseudo-random helpers.
// Every value is a pure function of its integer inputs, so any frame can be
// rendered in isolation (required for Remotion's parallel rendering).

const mix = (h: number, v: number): number => {
  h = Math.imul(h ^ (v | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae3d);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash any number of integers to a float in [0, 1). */
export const rand = (...keys: number[]): number => {
  let h = 0x811c9dc5;
  for (const k of keys) h = mix(h, k);
  return h / 4294967296;
};

/** Integer in [0, n). */
export const randInt = (n: number, ...keys: number[]): number =>
  Math.floor(rand(...keys) * n);

/** Random digit string of length n. */
export const digits = (n: number, ...keys: number[]): string => {
  let s = "";
  for (let i = 0; i < n; i++) s += String(randInt(10, ...keys, i));
  return s;
};

/**
 * Epoch counter for an element that "ticks" at an irregular-looking but
 * deterministic rate. Each element id gets its own period and phase.
 */
export const epoch = (
  frame: number,
  id: number,
  minPeriod: number,
  maxPeriod: number,
): number => {
  const period = minPeriod + Math.floor(rand(id, 7) * (maxPeriod - minPeriod + 1));
  const phase = Math.floor(rand(id, 13) * period);
  return Math.floor((frame + phase) / period);
};

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
