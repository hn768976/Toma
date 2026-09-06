// A tiny deterministic PRNG (mulberry32). Every random quantity in this
// project — base positions, orbit parameters, depth, accent assignment, grain —
// comes from here with a fixed seed, so any two renders of the same frame are
// byte-identical. Remotion renders frames out of order across threads, so
// Math.random() or anything accumulated frame-to-frame would flicker.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Normally distributed sample from a uniform generator (Box–Muller), used to
// scatter nodes around a cluster centre.
export const gaussian = (rand: () => number) => {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
