/**
 * Looping turbulent noise, built as a sum of band-limited travelling waves.
 *
 * Ordinary value/Perlin noise animated by advancing a time axis never returns
 * to where it started, so it cannot be looped. Here the field is
 *
 *     f(x, y, t) = SUM_i  amp_i * sin( 2pi (fx_i x + fy_i y) + 2pi k_i t + p_i )
 *
 * with every k_i an integer number of cycles per loop, so f(x, y, 0) and
 * f(x, y, 1) are identical by construction — the shimmer closes exactly at the
 * end of the composition, whatever the parameters. Spatial frequencies are
 * whole cycles across the sampled span for the same tidiness. With a dozen or
 * so waves at randomised directions the result is indistinguishable from
 * turbulence, and it costs two multiplies per wave per pixel: the angle-sum
 * identity lets the x-dependent half be precomputed once and reused for every
 * frame and every row.
 *
 * Deterministic: the whole band is derived from a string seed.
 */

import { TAU } from "../constants";
import { rand01, randInt, randRange } from "./seededRandom";

export interface SpectralBand {
  count: number;
  size: number;
  /** TAU * fy_i, in radians per grid step. */
  wy: Float32Array;
  /** Whole cycles per loop. */
  cycles: Float32Array;
  phase: Float32Array;
  amp: Float32Array;
  /** Per-wave, per-column sin/cos of the x term. size * count entries. */
  sinX: Float32Array;
  cosX: Float32Array;
  norm: number;
}

/**
 * @param seed        stable string seed
 * @param count       number of waves in the band
 * @param minFreq     lowest spatial frequency, in whole cycles across `size`
 * @param maxFreq     highest spatial frequency
 * @param minCycles   lowest temporal frequency, in whole cycles per loop
 * @param maxCycles   highest temporal frequency
 * @param size        grid edge length in samples
 */
export const buildSpectralBand = (
  seed: string,
  count: number,
  minFreq: number,
  maxFreq: number,
  minCycles: number,
  maxCycles: number,
  size: number,
): SpectralBand => {
  const wy = new Float32Array(count);
  const cycles = new Float32Array(count);
  const phase = new Float32Array(count);
  const amp = new Float32Array(count);
  const sinX = new Float32Array(count * size);
  const cosX = new Float32Array(count * size);
  let ampSum = 0;

  for (let i = 0; i < count; i++) {
    const angle = rand01(`${seed}-angle-${i}`) * TAU;
    const magnitude = randRange(`${seed}-mag-${i}`, minFreq, maxFreq);
    // Whole cycles across the span keep every frequency an integer multiple
    // of the base spatial frequency.
    let fx = Math.round(Math.cos(angle) * magnitude);
    const fy = Math.round(Math.sin(angle) * magnitude);
    if (fx === 0 && fy === 0) fx = Math.max(1, Math.round(minFreq));

    wy[i] = (TAU * fy) / size;
    cycles[i] = randInt(`${seed}-cycles-${i}`, minCycles, maxCycles);
    phase[i] = rand01(`${seed}-phase-${i}`) * TAU;
    // Larger features carry more energy, as in natural turbulence.
    amp[i] = 1 / (0.6 + magnitude / Math.max(1, minFreq));
    ampSum += amp[i];

    const wx = (TAU * fx) / size;
    for (let x = 0; x < size; x++) {
      const a = wx * x;
      sinX[i * size + x] = Math.sin(a);
      cosX[i * size + x] = Math.cos(a);
    }
  }

  return { count, size, wy, cycles, phase, amp, sinX, cosX, norm: 1 / ampSum };
};

/**
 * Evaluates the band over its whole grid at loop position `t` in [0, 1),
 * writing values in [-1, 1] into `out` (length size * size).
 */
export const sampleSpectralBand = (
  band: SpectralBand,
  t: number,
  out: Float32Array,
): void => {
  const { count, size, wy, cycles, phase, amp, sinX, cosX, norm } = band;
  out.fill(0);

  for (let i = 0; i < count; i++) {
    const base = i * size;
    const a = amp[i] * norm;
    const timePhase = TAU * cycles[i] * t + phase[i];
    for (let y = 0; y < size; y++) {
      // B = 2pi fy y + 2pi k t + p, constant along the row.
      const b = wy[i] * y + timePhase;
      const sinB = Math.sin(b) * a;
      const cosB = Math.cos(b) * a;
      const row = y * size;
      for (let x = 0; x < size; x++) {
        // sin(A + B) = sinA cosB + cosA sinB
        out[row + x] += sinX[base + x] * cosB + cosX[base + x] * sinB;
      }
    }
  }
};

/**
 * Multiplies a slow, large-scale band by a fast, fine-scale one — the layered
 * construction that reads as turbulence rather than as either band alone —
 * and maps the product into [0, 1] centred on 0.5.
 */
export const combineBands = (
  low: Float32Array,
  high: Float32Array,
  lowWeight: number,
  highWeight: number,
  contrast: number,
  out: Float32Array,
): void => {
  for (let i = 0; i < out.length; i++) {
    const a = 0.5 + 0.5 * lowWeight * low[i];
    const b = 0.5 + 0.5 * highWeight * high[i];
    const v = 0.5 + (a * b * 4 - 1) * 0.5 * contrast;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
};
