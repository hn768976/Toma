/**
 * noiseField.ts — layered value noise with a loop-closing mode.
 *
 * WHAT IT DOES
 *   Returns a sampler `(x, y, t) => number` in [-1, 1], built from
 *   several octaves of smoothed value noise summed at halving amplitude.
 *
 * WHAT IT IS FOR
 *   Organic variation that is continuous in space and time: drifting fog,
 *   flow fields that steer particles, terrain, wobble on a hand-drawn
 *   line, flicker that is not per-element random.
 *
 * WHY THE INTEGER-FREQUENCY MODE MATTERS
 *   Stock footage loops. A field animated by feeding `t` into a sine
 *   only returns to its starting state if every temporal frequency
 *   completes a whole number of cycles across the loop. At an arbitrary
 *   frequency, frame 0 and frame N differ and the loop visibly jumps.
 *   With `integerFrequency: true`, every octave's temporal frequency is
 *   rounded to an integer, so t = 0 and t = 1 are identical BY
 *   CONSTRUCTION and the loop is seamless with no crossfade.
 *
 *   Pass t as `frame / durationInFrames`, NOT as a raw frame number.
 *
 * PARAMETERS
 *   seed              integer; same seed => same field
 *   octaves           layers to sum. Default 3. Each roughly doubles
 *                     cost; 4-5 is the practical ceiling per pixel.
 *   frequency         spatial frequency of octave 0, in cycles per unit
 *                     of x/y. Default 0.004 — about one feature per 250
 *                     px, which is a sensible scale at 1080p. Multiply by
 *                     your resolution scale for a 4K render.
 *   amplitude         output scale of octave 0. Default 1.
 *   lacunarity        frequency multiplier per octave. Default 2.
 *   gain              amplitude multiplier per octave. Default 0.5. Above
 *                     ~0.65 the high octaves dominate and it turns to
 *                     grit; below ~0.35 they vanish and you have one sine.
 *   timeFrequency     cycles across t = 0..1 for octave 0. Default 1.
 *   integerFrequency  round temporal frequencies so the field loops.
 *                     Default true. Turn off only for a non-looping shot.
 *
 * GOTCHA
 *   This is VALUE noise (smoothed lattice), not simplex. It is cheap and
 *   dependency-free but has mild axis-aligned structure — long horizontal
 *   and vertical streaks can appear at low octave counts. If a shot shows
 *   the field large and flat and the grid becomes visible, either raise
 *   octaves, or sample on a rotated coordinate frame, or bring in a
 *   simplex implementation and keep this interface.
 *
 * GOTCHA 2
 *   The sampler is a closure over precomputed octave settings. Build it
 *   ONCE in a useMemo — rebuilding per pixel is the usual performance
 *   mistake here.
 *
 * USAGE
 *   const noise = useMemo(() => noiseField({ seed: 2 }), []);
 *   const v = noise(x, y, frame / durationInFrames);
 */

import { seededRandom } from "../random/seededRandom";

export type NoiseFieldOptions = {
  seed: number;
  octaves?: number;
  frequency?: number;
  amplitude?: number;
  lacunarity?: number;
  gain?: number;
  timeFrequency?: number;
  integerFrequency?: boolean;
};

export type NoiseSampler = (x: number, y: number, t?: number) => number;

/** Smoothstep, for interpolating between lattice values. */
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Deterministic lattice value in [-1, 1] for integer coords. */
const latticeValue = (ix: number, iy: number, seed: number): number => {
  // Combine coordinates into one index, keeping it well-mixed so
  // neighbouring lattice points are uncorrelated.
  const index = ix * 73856093 + iy * 19349663;
  return seededRandom(index, seed) * 2 - 1;
};

/** Bilinear-interpolated value noise at one spatial frequency. */
const valueNoise2D = (x: number, y: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);

  const v00 = latticeValue(x0, y0, seed);
  const v10 = latticeValue(x0 + 1, y0, seed);
  const v01 = latticeValue(x0, y0 + 1, seed);
  const v11 = latticeValue(x0 + 1, y0 + 1, seed);

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
};

export const noiseField = ({
  seed,
  octaves = 3,
  frequency = 0.004,
  amplitude = 1,
  lacunarity = 2,
  gain = 0.5,
  timeFrequency = 1,
  integerFrequency = true,
}: NoiseFieldOptions): NoiseSampler => {
  // Precompute per-octave settings so the sampler does no setup work.
  const layers = Array.from({ length: Math.max(1, octaves) }, (_, i) => {
    const rawTimeFrequency = timeFrequency * Math.pow(lacunarity, i);
    return {
      frequency: frequency * Math.pow(lacunarity, i),
      amplitude: amplitude * Math.pow(gain, i),
      // Rounding here is what closes the loop. Max(1, ...) stops an
      // octave rounding to 0 and freezing.
      timeFrequency: integerFrequency
        ? Math.max(1, Math.round(rawTimeFrequency))
        : rawTimeFrequency,
      seed: seed + i * 101,
    };
  });

  // Normalise so the summed octaves stay within [-1, 1].
  const totalAmplitude = layers.reduce((sum, l) => sum + l.amplitude, 0) || 1;

  return (x, y, t = 0) => {
    let sum = 0;
    for (const layer of layers) {
      // Time enters as a circular offset: moving the sample point around
      // a circle in a third dimension means t = 0 and t = 1 land on the
      // same place, which is what makes the loop close.
      const angle = t * layer.timeFrequency * Math.PI * 2;
      const tx = x * layer.frequency + Math.cos(angle);
      const ty = y * layer.frequency + Math.sin(angle);
      sum += valueNoise2D(tx, ty, layer.seed) * layer.amplitude;
    }
    return sum / totalAmplitude;
  };
};
