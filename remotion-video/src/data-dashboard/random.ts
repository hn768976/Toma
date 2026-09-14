// Deterministic PRNG (mulberry32). Every generated value in these
// dashboards - series shape, bar heights, marker jitter - is derived
// from an integer seed through this, never from Math.random(), because
// Remotion renders frames out of order across workers and anything that
// isn't a pure function of (seed, frame) would flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// One-shot value for an (index, salt) pair, for cases where keeping a
// generator around would be awkward.
export const seededRandom = (index: number, salt: number) => {
  return mulberry32(index * 9781 + salt * 6151 + 1)();
};
