// mulberry32 — a tiny deterministic PRNG. Every "random" quantity in this
// project (dot jitter, dot sizes, typing rhythm, grain) is derived from an
// index through this, never from Math.random() or Date.now(): Remotion
// renders frames out of order across threads, so anything that is not a
// pure function of its inputs flickers between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRandom = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1)();
