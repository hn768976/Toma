/**
 * A tiny deterministic PRNG (mulberry32). Every per-stroke value — alpha
 * jitter, accent membership — is derived from the stroke's index through this,
 * never from Math.random(): Remotion renders frames out of order across
 * worker threads, so anything that isn't a pure function of (index, frame)
 * would pop between frames.
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
