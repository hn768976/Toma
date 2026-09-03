import { random } from "remotion";

/**
 * A smooth, seamlessly periodic noise field over (angle, time).
 *
 * Built for driving per-element magnitude around a circle — bar lengths,
 * radii, brightness — anywhere you want an audio-visualiser flow rather
 * than independent jitter.
 *
 * It is a sum of angular harmonics with INTEGER mode numbers, which is
 * what makes it wrap perfectly around the circle: there is no seam where
 * the last bar meets the first. Each harmonic drifts at its own angular
 * rate, so the pattern flows around the ring instead of pulsing in place.
 *
 * Neighbouring samples are necessarily correlated because the highest
 * default mode (13) has a wavelength of ~28 degrees. Independent
 * per-element randomness would give a spiky mess instead of a flowing
 * waveform.
 */
export type Harmonic = {
  /** Cycles around the full circle. Integer, so the field is seamless. */
  mode: number;
  amplitude: number;
  /** Radians per second of drift. Sign sets which way the wave travels. */
  omega: number;
  phase: number;
};

export type HarmonicOptions = {
  /** Cycles around the circle. Must be integers to stay seamless. */
  modes?: number[];
  /** One weight per mode; falls off so low modes dominate. */
  amplitudes?: number[];
  /** Drift rate range, radians per second. */
  minOmega?: number;
  maxOmega?: number;
};

export const DEFAULT_MODES = [2, 3, 5, 8, 13];
export const DEFAULT_AMPLITUDES = [1, 0.62, 0.42, 0.26, 0.16];

/**
 * Gain applied before clamping in `sampleNoise`. The harmonics rarely
 * align, so the raw sum occupies well under its theoretical range; this
 * expands it to fill 0-1 without clipping more than occasionally. With
 * the defaults the field spans the full range, sits symmetrically about
 * 0.5, and clips at either rail about 3% of the time.
 */
export const DEFAULT_GAIN = 1.35;

/**
 * Builds a harmonic set from a stable string seed. Same seed, same set,
 * in every render worker.
 */
export const makeHarmonics = (
  seed: string,
  options: HarmonicOptions = {},
): Harmonic[] => {
  const {
    modes = DEFAULT_MODES,
    amplitudes = DEFAULT_AMPLITUDES,
    minOmega = 0.35,
    maxOmega = 1.25,
  } = options;
  const omegaSpan = maxOmega - minOmega;
  return modes.map((mode, i) => ({
    mode,
    amplitude: amplitudes[i] ?? 1 / (i + 1),
    omega:
      (minOmega + random(`${seed}-omega-${i}`) * omegaSpan) *
      (random(`${seed}-dir-${i}`) > 0.5 ? 1 : -1),
    phase: random(`${seed}-phase-${i}`) * Math.PI * 2,
  }));
};

/**
 * Samples the field at `angle` (radians) and `seconds`, returning 0-1.
 * A pure function of its arguments — no frame-to-frame state, so any
 * frame can be rendered in isolation and out of order.
 */
export const sampleNoise = (
  harmonics: Harmonic[],
  angle: number,
  seconds: number,
  gain: number = DEFAULT_GAIN,
): number => {
  let sum = 0;
  let total = 0;
  for (const h of harmonics) {
    sum += h.amplitude * Math.sin(h.mode * angle + h.omega * seconds + h.phase);
    total += h.amplitude;
  }
  const normalised = (sum / total) * gain;
  return 0.5 + 0.5 * Math.max(-1, Math.min(1, normalised));
};
