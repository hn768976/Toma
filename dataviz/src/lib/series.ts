import { mulberry32, type Rnd } from "./random";

/**
 * Periodic data series.
 *
 *   value(i) = base + SUM_k a_k * sin(2*PI*f_k*(i/N) + phi_k)
 *
 * Every f_k is an integer and N is the series length, so value(N) === value(0)
 * exactly and the series wraps seamlessly. That is what makes the scrolling
 * window loop close: the window advances exactly N positions over the
 * composition, so frame `durationInFrames` reproduces frame 0.
 */
export type Harmonic = { f: number; a: number; phi: number };

export const makeHarmonics = (
  rnd: Rnd,
  freqs: readonly number[],
  amps: readonly number[],
): Harmonic[] =>
  freqs.map((f, i) => ({
    f: Math.round(f),
    a: amps[i] ?? amps[amps.length - 1],
    phi: rnd() * Math.PI * 2,
  }));

export type Series = {
  /** Sample at an integer index (wraps). */
  at: (i: number) => number;
  /** Sample at a fractional index, smooth and wrapping. */
  atF: (x: number) => number;
  /** Normalised to 0..1 across the whole cycle. */
  norm: (x: number) => number;
  n: number;
  min: number;
  max: number;
};

export const periodicSeries = (opts: {
  n: number;
  base: number;
  harmonics: Harmonic[];
  /** optional monotone trend added as a periodic sawtooth-free ramp */
  seed?: number;
}): Series => {
  const { n, base, harmonics } = opts;

  const raw = (x: number) => {
    let v = base;
    for (const h of harmonics) {
      v += h.a * Math.sin((Math.PI * 2 * h.f * x) / n + h.phi);
    }
    return v;
  };

  // Precompute the integer samples once so min/max are exact and cheap.
  const samples = new Array<number>(n);
  for (let i = 0; i < n; i++) samples[i] = raw(i);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = max - min || 1;

  return {
    n,
    min,
    max,
    at: (i: number) => samples[((i % n) + n) % n],
    // raw() is already continuous and periodic, so fractional sampling needs
    // no interpolation between stored samples.
    atF: (x: number) => raw(x),
    norm: (x: number) => (raw(x) - min) / span,
  };
};

/** Convenience: a seeded periodic series in one call. */
export const seededSeries = (
  seed: number,
  n: number,
  freqs: readonly number[],
  amps: readonly number[],
  base = 0,
): Series => {
  const rnd = mulberry32(seed);
  return periodicSeries({ n, base, harmonics: makeHarmonics(rnd, freqs, amps) });
};

/**
 * The scrolling data window. Over `durationInFrames` the window advances
 * exactly `n` positions, so the composition's last+1 frame is its first.
 */
export const windowStart = (frame: number, durationInFrames: number, n: number) =>
  (n * frame) / durationInFrames;

/** Loop phase in 0..1, exactly 0 again at frame === durationInFrames. */
export const phase = (frame: number, durationInFrames: number) =>
  frame / durationInFrames;
