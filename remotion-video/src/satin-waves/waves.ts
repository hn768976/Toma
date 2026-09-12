/**
 * The height field is a sum of travelling sine waves plus a travelling
 * domain warp. Every time-dependent term advances by a whole number of
 * cycles per loop, so the whole field is exactly periodic and the video
 * loops seamlessly with no crossfade.
 */

export type Wave = {
  /** Wave-vector magnitude, in radians per frame-height. */
  k: number;
  /** Wave-vector direction in degrees. Folds run perpendicular to this. */
  angle: number;
  /** Whole cycles advanced per loop. Must be an integer to stay seamless. */
  cycles: number;
  /** Static phase offset, so the layers don't all peak together. */
  phase: number;
  amp: number;
  /** Spatial band, used by the depth-of-field falloff: 0 = swells, 2 = crumples. */
  band: 0 | 1 | 2;
};

/**
 * Directions sit in a narrow fan so the folds read as one coherent drape
 * rather than isotropic noise — the cross-cutting layer at -22 deg keeps it
 * from looking like corduroy.
 */
export const WAVES: Wave[] = [
  { k: 5.6, angle: 32, cycles: 1, phase: 0.0, amp: 1.0, band: 0 },
  { k: 7.4, angle: 58, cycles: 1, phase: 1.73, amp: 0.74, band: 0 },
  { k: 11.0, angle: 20, cycles: 2, phase: 3.11, amp: 0.46, band: 1 },
  { k: 14.2, angle: 46, cycles: 1, phase: 5.24, amp: 0.33, band: 1 },
  { k: 17.5, angle: -22, cycles: 2, phase: 2.41, amp: 0.24, band: 1 },
  { k: 23.0, angle: 36, cycles: 3, phase: 0.92, amp: 0.15, band: 2 },
  { k: 29.0, angle: 12, cycles: 2, phase: 4.35, amp: 0.1, band: 2 },
  { k: 36.0, angle: 50, cycles: 3, phase: 1.55, amp: 0.065, band: 2 },
];

export const WAVE_COUNT = WAVES.length;

/** Packed as (kx, ky, cycles, phase) per wave, for `uniform vec4 uWave[]`. */
export const packWaveVectors = (): Float32Array => {
  const data = new Float32Array(WAVE_COUNT * 4);
  WAVES.forEach((w, i) => {
    const rad = (w.angle * Math.PI) / 180;
    data[i * 4 + 0] = w.k * Math.cos(rad);
    data[i * 4 + 1] = w.k * Math.sin(rad);
    data[i * 4 + 2] = w.cycles;
    data[i * 4 + 3] = w.phase;
  });
  return data;
};

/** Packed as (amp, band) per wave, for `uniform vec2 uWaveAmpBand[]`. */
export const packWaveAmplitudes = (): Float32Array => {
  const data = new Float32Array(WAVE_COUNT * 2);
  WAVES.forEach((w, i) => {
    data[i * 2 + 0] = w.amp;
    data[i * 2 + 1] = w.band;
  });
  return data;
};

/** Scales the summed height back into roughly [-1, 1]. */
export const amplitudeNorm = (): number =>
  1 / WAVES.reduce((sum, w) => sum + w.amp, 0);
