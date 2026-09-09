import {BAND_COUNT} from '../spectrum/spectrum';

/**
 * Frequency coordinate for a bar laid around a circle: 0 (lowest band) at the
 * top, 1 (highest) at the bottom, climbing down one side and back up the other.
 *
 * The mirror is deliberate. A spectrum has two ends; wrapping it straight round
 * a circle puts the top band next to the bottom one and leaves a permanent seam
 * in the ring. Shared by V1 and V3 so both read as the same instrument.
 */
export const barFrequency = (i: number, count: number): number =>
  1 - Math.abs(1 - (2 * i) / count);

/** Fractional band index a bar reads from. */
export const barBand = (i: number, count: number): number =>
  barFrequency(i, count) * (BAND_COUNT - 1);

/** Sample the spectrum at a fractional band index. */
export const sampleBand = (spectrum: number[], bandPos: number): number => {
  const i0 = Math.max(0, Math.min(spectrum.length - 1, Math.floor(bandPos)));
  const i1 = Math.min(spectrum.length - 1, i0 + 1);
  const f = bandPos - i0;
  return spectrum[i0] + (spectrum[i1] - spectrum[i0]) * f;
};
