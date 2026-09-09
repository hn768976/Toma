import {mulberry32} from '../spectrum/random';
import {PERIOD, getSpectrum} from '../spectrum/spectrum';

/** World units between samples along the waveform. */
export const SAMPLE_SPACING = 0.045;

/**
 * Samples in one waveform period. With SAMPLE_SPACING that makes the track
 * 108 world units long, and the camera scrolls exactly that far over the
 * 300-frame composition, which is what closes the loop.
 */
export const TRACK_SAMPLES = 2400;

/** Length of one waveform period, in world units. */
export const TRACK_LENGTH = TRACK_SAMPLES * SAMPLE_SPACING;

/**
 * Half-height of each waveform sample, in world units. The line is mirrored
 * about the centre line, so a sample spans -h..+h across the plane.
 *
 * Sample n is the spectrum as it stood at the moment that sample arrived:
 * frame = n / TRACK_SAMPLES * PERIOD. That makes the track a fixed, periodic
 * object which simply scrolls past the camera — so it is built once here rather
 * than re-derived every frame.
 */
export const TRACK: Float32Array = (() => {
  const out = new Float32Array(TRACK_SAMPLES);
  const rand = mulberry32(0x2b17_9ac3);

  // Loud passages and quiet ones. Real audio is not uniform along its length,
  // and a waveform of constant height reads as a ribbon, not as sound.
  const passagePhase = rand();
  const ripplePhase = rand() * Math.PI * 2;
  const ripplePhase2 = rand() * Math.PI * 2;

  // Scattered transients that punch well above the body of the waveform.
  const transients: {at: number; gain: number; width: number}[] = [];
  for (let i = 0; i < 6; i++) {
    transients.push({
      at: rand() * TRACK_SAMPLES,
      gain: 2.4 + rand() * 2.6,
      width: 9 + rand() * 26,
    });
  }

  for (let n = 0; n < TRACK_SAMPLES; n++) {
    const spectrum = getSpectrum((n / TRACK_SAMPLES) * PERIOD);

    // Weight the low and low-mid bands: that is where a waveform's body is.
    let level = 0;
    let weightSum = 0;
    for (let b = 0; b < spectrum.length; b++) {
      const w = Math.pow(1 - b / spectrum.length, 1.6) + 0.12;
      level += spectrum[b] * w;
      weightSum += w;
    }
    level /= weightSum;

    // Five passages per period, cubed so the gaps between them go properly
    // quiet rather than merely quieter.
    const u = n / TRACK_SAMPLES;
    const passage =
      0.06 +
      0.94 * Math.pow(0.5 + 0.5 * Math.sin((u * 5 + passagePhase) * Math.PI * 2), 3);

    // Sample-to-sample ripple, so individual lines differ and the block reads
    // as a waveform rather than as a filled shape. Integer cycle counts keep
    // the ripple periodic in n along with everything else.
    const ripple =
      0.55 +
      0.3 * Math.sin((274 * u) * Math.PI * 2 + ripplePhase) +
      0.15 * Math.sin((122 * u) * Math.PI * 2 + ripplePhase2);

    let amp = level * passage * ripple;

    for (const t of transients) {
      // Wrap-aware distance, so a transient near the seam stays intact.
      let d = Math.abs(n - t.at);
      d = Math.min(d, TRACK_SAMPLES - d);
      amp += t.gain * level * passage * Math.exp(-(d * d) / (2 * t.width * t.width));
    }

    // Soft saturation rather than a hard clamp: a limiter rounds its peaks,
    // and a hard cap would give the tall transients flat tops.
    const cap = 0.9;
    out[n] = 0.005 + cap * Math.tanh((amp * 1.7) / cap);
  }

  return out;
})();

/** Half-height of the sample at index n, wrapping. */
export const trackAt = (n: number): number =>
  TRACK[((n % TRACK_SAMPLES) + TRACK_SAMPLES) % TRACK_SAMPLES];
