// Deterministic PRNG (mulberry32) seeded from a string. Sparkle and particle
// placement is keyed on the subject id so a subject's arrangement is stable
// across renders and identical between its colourways.
export const hashString = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRng = (key: string) => mulberry32(hashString(key));

export const range = (rng: () => number, min: number, max: number) =>
  min + (max - min) * rng();
