import {clamp, lerp, mulberry32} from './random';

/**
 * The shared synthetic spectrum engine.
 *
 * All three compositions are different renderings of this one signal. There is
 * no audio file: a synthetic spectrum is deterministic, loops cleanly, and
 * sidesteps music licensing entirely.
 *
 * Two properties do the heavy lifting:
 *
 *  - Low bands move slowly with large amplitude, high bands flicker fast with
 *    small amplitude. That contrast is what makes the result read as audio
 *    rather than as noise.
 *  - Every oscillator completes an integer number of cycles over PERIOD frames,
 *    so the signal is exactly periodic and the 300-frame loops close.
 */

/** Loop length of the signal, in frames. */
export const PERIOD = 300;

/** Frames between beats. Divides 300 (V1/V2) and 450 (V3) evenly — 120 BPM. */
export const BEAT_FRAMES = 30;

/** Number of spectrum bands. */
export const BAND_COUNT = 96;

/** Oscillators stacked per band. */
const HARMONICS = 3;

type Band = {
  /** Integer cycles over PERIOD, one per harmonic — keeps the loop closed. */
  cycles: number[];
  /** Phase offset in turns, one per harmonic. */
  phases: number[];
  /** Weight of each harmonic. */
  weights: number[];
  /** Static level of the band (spectral tilt plus per-band character). */
  level: number;
  /** How hard the beat lifts this band. */
  beatWeight: number;
};

const buildBands = (seed: number, count: number): Band[] => {
  const rand = mulberry32(seed);
  const bands: Band[] = [];

  for (let i = 0; i < count; i++) {
    // t = 0 at the lowest band, 1 at the highest.
    const t = count === 1 ? 0 : i / (count - 1);

    // Base rate: ~2 cycles per loop at the bottom, ~34 at the top. Rounded so
    // every harmonic lands on an integer number of cycles per PERIOD.
    const base = Math.max(1, Math.round(lerp(2, 34, Math.pow(t, 1.55))));

    const cycles: number[] = [];
    const phases: number[] = [];
    const weights: number[] = [];
    for (let h = 0; h < HARMONICS; h++) {
      cycles.push(Math.max(1, Math.round(base * (1 + h * 0.77) + h)));
      phases.push(rand());
      weights.push(1 / (h + 1.35));
    }
    const weightSum = weights.reduce((a, b) => a + b, 0);
    for (let h = 0; h < HARMONICS; h++) {
      weights[h] /= weightSum;
    }

    // Spectral tilt: lows carry most of the energy, plus a little per-band
    // variation so neighbouring bars are not identical.
    const tilt = lerp(1, 0.3, Math.pow(t, 0.72));
    const level = tilt * lerp(0.8, 1.2, rand());

    // Kick energy sits in the bottom third but the beat lifts everything.
    const beatWeight = lerp(1, 0.34, Math.pow(t, 0.55));

    bands.push({cycles, phases, weights, level, beatWeight});
  }

  return bands;
};

const BANDS = buildBands(0x5eed_1a7f, BAND_COUNT);

/**
 * Global beat envelope: a 2-frame attack, then an exponential decay.
 * Periodic in BEAT_FRAMES, and BEAT_FRAMES divides every composition length.
 */
export const beatEnvelope = (frame: number, beatFrames = BEAT_FRAMES): number => {
  const phase = ((frame % beatFrames) + beatFrames) % beatFrames;
  const attack = 2;
  if (phase < attack) {
    return phase / attack;
  }
  return Math.exp(-(phase - attack) * 0.42);
};

/**
 * The amount by which a band's own oscillators, ignoring the beat, deviate
 * from silence. Split out so views can drive glow separately from height.
 */
const bandOscillation = (band: Band, frame: number, period: number): number => {
  let v = 0;
  for (let h = 0; h < band.cycles.length; h++) {
    const turns = (band.cycles[h] * frame) / period + band.phases[h];
    v += band.weights[h] * (0.5 + 0.5 * Math.sin(turns * Math.PI * 2));
  }
  return v;
};

export type SpectrumOptions = {
  /** Frames over which the signal repeats. Defaults to PERIOD (300). */
  period?: number;
  /** Frames between beats. Defaults to BEAT_FRAMES (30). */
  beatFrames?: number;
};

/**
 * The spectrum at a given frame: BAND_COUNT values in 0..1, band 0 lowest.
 * A pure function of `frame` — safe to call from any thread, in any order.
 */
export const getSpectrum = (
  frame: number,
  options: SpectrumOptions = {},
): number[] => {
  const period = options.period ?? PERIOD;
  const beat = beatEnvelope(frame, options.beatFrames ?? BEAT_FRAMES);

  const out = new Array<number>(BANDS.length);
  for (let i = 0; i < BANDS.length; i++) {
    const band = BANDS[i];
    const osc = bandOscillation(band, frame, period);
    // Slight compression keeps the quiet passages quiet without flattening peaks.
    const shaped = Math.pow(osc, 1.35);
    const value = band.level * shaped * 0.82 + beat * band.beatWeight * 0.34;
    out[i] = clamp(value);
  }
  return out;
};

/**
 * Peak each band reaches over one period. Computed once, numerically, because
 * the beat term makes the closed form more trouble than it is worth.
 */
const BAND_PEAKS: number[] = (() => {
  const peaks = new Array<number>(BANDS.length).fill(0);
  for (let f = 0; f < PERIOD; f++) {
    const spectrum = getSpectrum(f);
    for (let i = 0; i < spectrum.length; i++) {
      peaks[i] = Math.max(peaks[i], spectrum[i]);
    }
  }
  return peaks;
})();

/**
 * The spectrum with the spectral tilt divided back out, so every band uses the
 * full 0..1 range.
 *
 * V1 wants the tilt: it is what gives the ring dense fine bars at the bottom
 * and big slow ones at the top. V3 does not — with the tilt left in, the loud
 * bands sit permanently at one point on the ring and the spikes never move,
 * which is not how the reference behaves. Per-band normalisation is also what a
 * real visualiser's auto-gain does.
 */
export const getEqualizedSpectrum = (
  frame: number,
  options: SpectrumOptions = {},
): number[] => {
  const spectrum = getSpectrum(frame, options);
  for (let i = 0; i < spectrum.length; i++) {
    spectrum[i] = clamp(spectrum[i] / Math.max(1e-6, BAND_PEAKS[i]));
  }
  return spectrum;
};

/** Mean level of the spectrum at a frame, 0..1. Drives global reactions. */
export const getEnergy = (frame: number, options: SpectrumOptions = {}): number => {
  const spectrum = getSpectrum(frame, options);
  let sum = 0;
  for (let i = 0; i < spectrum.length; i++) {
    sum += spectrum[i];
  }
  return sum / spectrum.length;
};
