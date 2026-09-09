/**
 * Deterministic hashing. Every particle attribute is derived from its index
 * through these helpers — never from Math.random() or Date.now(). Remotion
 * renders frames out of order across workers, so anything that is not a pure
 * function of (index, frame) would flicker between frames.
 */

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Single-shot hash of two integers to [0, 1). */
export const hash01 = (a: number, b: number) => {
  let t = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
