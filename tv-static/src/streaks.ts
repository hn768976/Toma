import { hash01 } from "./hash";
import { REFERENCE_WIDTH } from "./constants";

/**
 * Layer 3: horizontal streak bands. Runs of pixels smeared sideways into
 * short dashes and broken lines, concentrated in bands that appear, persist
 * for a few frames and vanish.
 *
 * The smear is a horizontal *copy* of the base noise (sampled at an x-offset
 * and quantised into runs), never an average — blurring reads as digital
 * softening, not as a signal smearing along the scanline.
 */

type Band = {
  /** Frame the band switches on, in loop-local frames. */
  start: number;
  /** How many frames it persists. */
  duration: number;
  /** Normalised centre and half-height (fractions of frame height). */
  centre: number;
  halfHeight: number;
  /** Normalised run length and x offset (fractions of frame width). */
  run: number;
  offset: number;
  strength: number;
};

/**
 * Bands are scheduled across the whole loop, not per frame; with these
 * durations roughly three or four are live at any moment, which is what the
 * reference shows.
 */
const BAND_COUNT = 210;

const buildBands = (duration: number): Band[] => {
  const bands: Band[] = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    bands.push({
      start: Math.floor(hash01(b, 1, 101) * duration),
      duration: 2 + Math.floor(hash01(b, 2, 101) ** 2 * 8),
      centre: hash01(b, 3, 101),
      halfHeight: 0.0025 + hash01(b, 4, 101) ** 3 * 0.05,
      run: 0.003 + hash01(b, 5, 101) ** 2 * 0.028,
      offset: (hash01(b, 6, 101) - 0.5) * 0.07,
      strength: 0.45 + hash01(b, 7, 101) ** 0.7 * 0.55,
    });
  }
  return bands;
};

export type StreakRows = {
  gain: Float32Array;
  run: Int32Array;
  offset: Int32Array;
};

export class Streaks {
  private readonly bands: Band[];
  readonly rows: StreakRows;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly loopLength: number,
  ) {
    this.bands = buildBands(loopLength);
    this.rows = {
      gain: new Float32Array(height),
      run: new Int32Array(height),
      offset: new Int32Array(height),
    };
  }

  /** Recomputes per-row streak parameters for one frame. */
  build(frame: number): void {
    const { bands, height, width, loopLength, rows } = this;
    rows.gain.fill(0);
    rows.run.fill(1);
    rows.offset.fill(0);

    // Non-pixel-scale feature: keep the smear the same fraction of the line
    // width at any output resolution.
    const scale = width / REFERENCE_WIDTH;

    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      const age = (frame - band.start + loopLength) % loopLength;
      if (age >= band.duration) continue;

      // Hard on, hard off — analogue dropout does not fade — but the first
      // and last frame come in at part strength so short bands still flicker.
      const edge = age === 0 || age === band.duration - 1 ? 0.65 : 1;

      const centreY = band.centre * height;
      const half = Math.max(1, band.halfHeight * height);
      const y0 = Math.max(0, Math.ceil(centreY - half));
      const y1 = Math.min(height - 1, Math.floor(centreY + half));

      for (let y = y0; y <= y1; y++) {
        // Fall off over the outer fifth of the band so it does not end on a
        // razor-straight edge.
        const d = Math.abs(y - centreY) / half;
        const falloff = d > 0.8 ? (1 - d) / 0.2 : 1;
        const g = band.strength * edge * falloff;
        if (g <= rows.gain[y]) continue;

        // Each scanline smears slightly differently.
        const jitter = hash01(y, b, frame + 613);
        rows.gain[y] = g;
        rows.run[y] = Math.max(
          1,
          Math.round(band.run * width * (0.55 + jitter * 1.1)),
        );
        rows.offset[y] = Math.round(
          band.offset * width + (jitter - 0.5) * 26 * scale,
        );
      }
    }
  }
}
