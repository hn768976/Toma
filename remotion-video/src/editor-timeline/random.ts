// Deterministic PRNG (mulberry32). Every random-looking value in the
// scene - waveform amplitudes, badge placement, clip label digits,
// bokeh jitter - is derived from a fixed seed through this, never from
// Math.random(): Remotion renders frames out of order across workers,
// so anything that isn't a pure function of (seed, frame) would flicker.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seeded = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1)();

// Smooth 1-D value noise in [0, 1], used for waveform envelopes and the
// handheld camera drift. Continuous, so it never pops between frames.
export const noise1d = (x: number, salt: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = seeded(i, salt);
  const b = seeded(i + 1, salt);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
};
