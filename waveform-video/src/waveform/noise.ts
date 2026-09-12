/**
 * Seamlessly looping 2D value noise.
 *
 * The waveform in the reference clip is not a scrolling pattern — neighbouring
 * bars are correlated and each bar drifts smoothly on its own, like hills
 * morphing in place. That is a 2D noise field sampled over (bar, time).
 *
 * Both axes of the lattice wrap, so sampling time over exactly one full
 * revolution returns to the starting frame: frame 0 and frame N are identical
 * and the clip loops without a seam.
 */

/** Small, fast, fully deterministic PRNG so every render is identical. */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Ken Perlin's smootherstep — C2 continuous, so the motion has no visible kinks. */
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Lattice = {
  readonly nx: number;
  readonly nt: number;
  readonly values: readonly number[];
};

const createLattice = (nx: number, nt: number, seed: number): Lattice => {
  const random = mulberry32(seed);
  const values: number[] = [];
  for (let i = 0; i < nx * nt; i++) {
    values.push(random());
  }
  return { nx, nt, values };
};

/**
 * Bilinear sample with smootherstep easing. `x` and `t` are in lattice units;
 * both wrap, which is what makes the loop seamless.
 */
const sampleLattice = (lattice: Lattice, x: number, t: number) => {
  const { nx, nt, values } = lattice;

  const x0 = Math.floor(x);
  const t0 = Math.floor(t);
  const fx = smootherstep(x - x0);
  const ft = smootherstep(t - t0);

  const xa = ((x0 % nx) + nx) % nx;
  const xb = (xa + 1) % nx;
  const ta = ((t0 % nt) + nt) % nt;
  const tb = (ta + 1) % nt;

  const v00 = values[ta * nx + xa];
  const v10 = values[ta * nx + xb];
  const v01 = values[tb * nx + xa];
  const v11 = values[tb * nx + xb];

  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), ft);
};

/**
 * Octaves of the field. The first carries the broad hills, the later ones add
 * the smaller bumps that keep neighbouring bars from marching in lockstep.
 * Each octave's lattice is finer in both space and time, so detail moves faster
 * than the hills it rides on.
 *
 * Tuned against the reference clip on two statistics — mean step between
 * neighbouring bars (reference 1.30 segments) and mean step of one bar between
 * frames (reference 0.11). These values land at 1.26 and 0.14: the same
 * silhouette, moving a touch more willingly.
 *
 * `nx` is in screen widths, not bars, so a denser grid resolves the same hills
 * more finely instead of shrinking them.
 */
const OCTAVES = [
  { nx: 5, nt: 5, amplitude: 0.62 },
  { nx: 10, nt: 9, amplitude: 0.26 },
  { nx: 20, nt: 17, amplitude: 0.12 },
] as const;

export type WaveformField = {
  /** Lit segment count for a bar, already quantised to whole LED rows. */
  readonly litRows: (bar: number, frame: number) => number;
};

export type WaveformFieldOptions = {
  readonly bars: number;
  readonly rows: number;
  readonly durationInFrames: number;
  readonly seed: number;
  /** Shortest bar, as a fraction of the full column height. */
  readonly minFill: number;
  /** Tallest bar, as a fraction of the full column height. */
  readonly maxFill: number;
  /**
   * Skews the height distribution. Value noise piles up around its midpoint,
   * which sits the bars higher than the reference does; >1 pushes them back
   * down so tall peaks stay occasional. Reference mean is 21.2 of 40 segments,
   * and 1.35 reproduces it.
   */
  readonly skew: number;
};

/**
 * Precomputes every bar height for the whole clip.
 *
 * Doing it up front costs one pass over `bars × durationInFrames` samples and
 * buys two things: the raw field can be normalised against its own true extremes
 * (so the clip always uses the full height range no matter the seed), and each
 * rendered frame only does an array lookup.
 */
export const createWaveformField = ({
  bars,
  rows,
  durationInFrames,
  seed,
  minFill,
  maxFill,
  skew,
}: WaveformFieldOptions): WaveformField => {
  const lattices = OCTAVES.map((octave, index) =>
    createLattice(octave.nx, octave.nt, seed + index * 7919),
  );

  const raw = new Float64Array(bars * durationInFrames);
  let lowest = Infinity;
  let highest = -Infinity;

  for (let frame = 0; frame < durationInFrames; frame++) {
    // One full revolution of the time axis over the clip: the value at
    // `durationInFrames` equals the value at 0, which is the seam-free loop.
    const revolution = frame / durationInFrames;

    for (let bar = 0; bar < bars; bar++) {
      const span = bar / bars;

      let value = 0;
      for (let i = 0; i < OCTAVES.length; i++) {
        const octave = OCTAVES[i];
        value +=
          octave.amplitude *
          sampleLattice(lattices[i], span * octave.nx, revolution * octave.nt);
      }

      raw[frame * bars + bar] = value;
      if (value < lowest) lowest = value;
      if (value > highest) highest = value;
    }
  }

  const range = highest - lowest || 1;
  const heights = new Uint16Array(bars * durationInFrames);

  for (let i = 0; i < raw.length; i++) {
    const normalised = ((raw[i] - lowest) / range) ** skew;
    const fill = minFill + normalised * (maxFill - minFill);
    // At least one lit segment: the reference never shows an empty column.
    heights[i] = Math.max(1, Math.min(rows, Math.round(fill * rows)));
  }

  return {
    litRows: (bar, frame) => {
      const wrapped =
        ((frame % durationInFrames) + durationInFrames) % durationInFrames;
      return heights[wrapped * bars + bar];
    },
  };
};
