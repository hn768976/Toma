// Deterministic PRNG helpers shared by the generative compositions.
//
// Remotion renders frames out of order across worker processes, so any
// value a frame depends on must be a pure function of its inputs — never
// Math.random() or Date.now(), or frames would flicker against each other.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRandom = (index: number, salt: number) => {
  const rand = mulberry32(index * 9781 + salt * 6151 + 1);
  return rand();
};

// Stateless 3-argument hash -> [0, 1). Used in the hot per-dot loops,
// where allocating a mulberry32 closure per sample would dominate the
// render time. Same guarantees, no allocation.
export const hash01 = (a: number, b: number, c: number) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (c | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
