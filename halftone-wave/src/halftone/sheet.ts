// The sheet: a dot grid pushed through a fixed baked projection, folded by
// a travelling wave.
//
// Every function here is pure. Anything that depends only on the grid (row
// scales, row offsets, colour buckets, jitter) is computed once by
// createSheet(); anything that depends on the frame is a pure function of
// the normalised loop time tN = frame / durationInFrames, which is why the
// motion loops exactly.

import {
  ALPHA_FAR,
  ALPHA_NEAR,
  BREATH_TERMS,
  COLOR_BIAS,
  COLOR_BUCKETS,
  COLS,
  FACING_HI,
  FACING_LO,
  HEIGHT_GAIN,
  HORIZON_FADE_ROWS,
  HORIZON_X,
  HORIZON_Y,
  JITTER,
  JITTER_SEED,
  PERSPECTIVE,
  ROWS,
  ROW_STEP,
  SHEET_ANGLE,
  SPREAD_HALF_FAR,
  WAVE2_AMPLITUDE,
  WAVE2_COUNT,
  WAVE2_SKEW,
  WAVE_AMPLITUDE,
  WAVE_COUNT,
  WAVE_SKEW,
} from "./constants";
import { mulberry32 } from "./random";

const TAU = Math.PI * 2;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export type Sheet = {
  cols: number;
  rows: number;
  /** Perspective scale per row: 1 at the far row, growing toward the near row. */
  rowScale: Float64Array;
  /** Sheet-space y of each row before the fold is applied. */
  rowY: Float64Array;
  /** Column spacing per row, in sheet-space px. */
  rowSpacing: Float64Array;
  /** Colour-ramp bucket index per row. */
  rowBucket: Uint16Array;
  /** Alpha from distance along the projection, times the horizon fade-in. */
  rowAlpha: Float64Array;
  /** Sheet-space x of every column, per row, is rowSpacing * (i - (cols-1)/2). */
  jitterX: Float64Array;
  jitterY: Float64Array;
  cos: number;
  sin: number;
  /** Largest absolute height the fold can reach, used to normalise crests. */
  heightMax: number;
};

export const createSheet = (): Sheet => {
  const rowScale = new Float64Array(ROWS);
  const rowY = new Float64Array(ROWS);
  const rowSpacing = new Float64Array(ROWS);
  const rowBucket = new Uint16Array(ROWS);
  const rowAlpha = new Float64Array(ROWS);

  let y = 0;
  for (let j = 0; j < ROWS; j++) {
    const jN = j / (ROWS - 1);
    const scale = 1 / (1 - PERSPECTIVE * jN);
    rowScale[j] = scale;
    rowY[j] = y;
    // Rows converge toward the horizon exactly as the horizontal spread
    // opens up, so the grid stays square-ish in sheet space.
    y += ROW_STEP * scale;
    rowSpacing[j] = (2 * SPREAD_HALF_FAR * scale) / (COLS - 1);
    rowBucket[j] = Math.min(
      COLOR_BUCKETS - 1,
      Math.floor(Math.pow(jN, COLOR_BIAS) * COLOR_BUCKETS),
    );
    const depth = ALPHA_FAR + (ALPHA_NEAR - ALPHA_FAR) * Math.pow(jN, 0.8);
    rowAlpha[j] = depth * smoothstep(0, HORIZON_FADE_ROWS, j);
  }

  // Deterministic sub-spacing jitter, generated once. Without it a perfectly
  // regular grid beats against the pixel grid at 4K and moires.
  const rand = mulberry32(JITTER_SEED);
  const jitterX = new Float64Array(COLS * ROWS);
  const jitterY = new Float64Array(COLS * ROWS);
  for (let k = 0; k < COLS * ROWS; k++) {
    jitterX[k] = (rand() - 0.5) * 2 * JITTER;
    jitterY[k] = (rand() - 0.5) * 2 * JITTER;
  }

  let heightMax = WAVE_AMPLITUDE + WAVE2_AMPLITUDE;
  for (const term of BREATH_TERMS) heightMax += term.amp;

  return {
    cols: COLS,
    rows: ROWS,
    rowScale,
    rowY,
    rowSpacing,
    rowBucket,
    rowAlpha,
    jitterX,
    jitterY,
    cos: Math.cos(SHEET_ANGLE),
    sin: Math.sin(SHEET_ANGLE),
    heightMax,
  };
};

/**
 * Height of the fold at grid position (iN, jN) at loop time tN.
 *
 * Both travelling terms subtract tN once, so the wave advances by exactly
 * one wavelength over the loop; the breathing terms use whole cycle counts.
 * The whole function therefore has period 1 in tN.
 */
export const heightAt = (iN: number, jN: number, tN: number): number => {
  let h =
    WAVE_AMPLITUDE *
      Math.sin(TAU * (jN * WAVE_COUNT + iN * WAVE_SKEW - tN)) +
    WAVE2_AMPLITUDE *
      Math.sin(TAU * (jN * WAVE2_COUNT + iN * WAVE2_SKEW - tN));
  for (const t of BREATH_TERMS) {
    h += t.amp * Math.sin(TAU * (t.cycles * tN + t.phase + t.kx * iN + t.ky * jN));
  }
  return h;
};

/**
 * How much the surface faces the viewer, in 0..1.
 *
 * Measured as the screen-space expansion of the row spacing: where the fold
 * tilts toward the viewer consecutive rows spread apart, where it turns away
 * they bunch up. The row scale cancels out of the ratio, so this depends
 * only on the height gradient along the sheet's length.
 */
export const facingAt = (iN: number, jN: number, tN: number, dj: number): number => {
  const dh = heightAt(iN, jN + dj, tN) - heightAt(iN, jN, tN);
  const expansion = 1 - (HEIGHT_GAIN / ROW_STEP) * dh;
  return smoothstep(FACING_LO, FACING_HI, expansion);
};

/** Sheet space -> frame space. Circles are rotation invariant, so this is
 *  the only place the diagonal sweep is applied. */
export const toScreenX = (sheet: Sheet, x: number, y: number): number =>
  HORIZON_X + x * sheet.cos + y * -sheet.sin;

export const toScreenY = (sheet: Sheet, x: number, y: number): number =>
  HORIZON_Y + x * sheet.sin + y * sheet.cos;
