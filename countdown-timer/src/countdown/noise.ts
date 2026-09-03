import { random } from "remotion";

/**
 * A smooth, seamlessly periodic noise field over (angle, time), used to
 * drive per-bar length around the ring.
 *
 * It is a sum of angular harmonics with INTEGER mode numbers, which is
 * what makes it wrap perfectly around the circle: there is no seam where
 * the last bar meets the first. Each harmonic drifts at its own angular
 * rate, so the pattern flows around the ring instead of pulsing in place.
 *
 * Neighbouring bars are necessarily correlated because the highest mode
 * present (13) has a wavelength of ~28 degrees, about six bars wide.
 * Independent per-bar randomness would give a spiky mess rather than the
 * flowing waveform of an audio visualiser.
 */
export type Harmonic = {
  /** Cycles around the full circle. Integer, so the field is seamless. */
  mode: number;
  amplitude: number;
  /** Radians per second of drift. Sign sets which way the wave travels. */
  omega: number;
  phase: number;
};

const MODES = [2, 3, 5, 8, 13];
const AMPLITUDES = [1, 0.62, 0.42, 0.26, 0.16];

/**
 * Gain applied before clamping. The harmonics rarely align, so the raw
 * sum occupies well under its theoretical range; this expands it to fill
 * the length range without clipping more than occasionally.
 */
const GAIN = 1.35;

export const makeHarmonics = (seed: string): Harmonic[] =>
  MODES.map((mode, i) => ({
    mode,
    amplitude: AMPLITUDES[i],
    omega:
      (0.35 + random(`${seed}-omega-${i}`) * 0.9) *
      (random(`${seed}-dir-${i}`) > 0.5 ? 1 : -1),
    phase: random(`${seed}-phase-${i}`) * Math.PI * 2,
  }));

/**
 * Samples the field at `angle` (radians) and `seconds`, returning 0-1.
 * A pure function of its arguments — no frame-to-frame state, so any
 * frame can be rendered in isolation and out of order.
 */
export const sampleNoise = (
  harmonics: Harmonic[],
  angle: number,
  seconds: number,
): number => {
  let sum = 0;
  let total = 0;
  for (const h of harmonics) {
    sum += h.amplitude * Math.sin(h.mode * angle + h.omega * seconds + h.phase);
    total += h.amplitude;
  }
  const normalised = (sum / total) * GAIN;
  return 0.5 + 0.5 * Math.max(-1, Math.min(1, normalised));
};
