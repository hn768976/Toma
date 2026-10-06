// Deterministic randomness only. Never Math.random() at render time.

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

// Integer hash → [0, 1). Stateless, so safe for out-of-order frames.
export const hash = (...ns: number[]): number => {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h ^= Math.floor(n) | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const pick = <T,>(arr: readonly T[], r: number): T =>
  arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
