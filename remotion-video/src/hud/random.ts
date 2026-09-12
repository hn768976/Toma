// Deterministic PRNG (mulberry32). Remotion renders frames out of order
// across parallel workers, so every "random" value must be a pure
// function of its seed -- never Math.random() or Date.now(), which would
// make elements pop and flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Convenience: a generator seeded by a string key, so each widget
// instance gets its own stable stream without hand-picking seed numbers.
export const rngFor = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return mulberry32(h);
};

export const pick = <T,>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length) % items.length];

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
