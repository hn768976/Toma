// A tiny deterministic PRNG (mulberry32). Particle "identity" (angle,
// radius, size, phase...) is derived from its index through this, never
// from Math.random() or Date.now() — Remotion can render frames out of
// order across workers, so anything that isn't a pure function of
// (particleIndex, frame) would cause popping/flicker between frames.
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
