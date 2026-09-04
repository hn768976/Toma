/**
 * Geometry and motion. Every value here is a pure function of
 * (row/band, frame mod durationInFrames) and every oscillator completes a
 * whole number of cycles per loop, so frame 600 is identical to frame 0.
 *
 * All sizes are fractions of the frame, so a 1080p preview (--scale=0.5) is
 * an exact downscale of the 4K render.
 */

import { TOTAL_ROWS } from "./content";
import { clamp, cyclicDelta, hash1, hash2, lerp, loopSin } from "./random";

/** Text rows visible on screen at once. */
export const ROWS_VISIBLE = 54;
/** Character cells across the visible width. */
export const COLUMNS = 150;
/** How many frames of jitter history are composited into the trail. */
export const TRAIL_STATES = 10;
/** Extra canvas either side of the frame so streaks never hit a hard edge. */
export const OVERSCAN_FRACTION = 0.09;

export type Layout = {
  width: number;
  height: number;
  /** Canvas width including the left and right overscan. */
  canvasWidth: number;
  overscan: number;
  rowHeight: number;
  charWidth: number;
  fontSize: number;
  pageHeight: number;
  /** Rows drawn per frame: one more than fits, for the partial row. */
  rowsDrawn: number;
};

export const getLayout = (width: number, height: number): Layout => {
  const rowHeight = height / ROWS_VISIBLE;
  const overscan = Math.round(width * OVERSCAN_FRACTION);
  return {
    width,
    height,
    canvasWidth: width + overscan * 2,
    overscan,
    rowHeight,
    charWidth: width / COLUMNS,
    fontSize: rowHeight * 0.8,
    pageHeight: rowHeight * TOTAL_ROWS,
    rowsDrawn: ROWS_VISIBLE + 2,
  };
};

/* ------------------------------------------------------------------ bands */

/**
 * Screen rows are grouped into uneven bands. Rows in a band jitter together
 * and share a blur amount — this uneven banding is what reads as a failing
 * display rather than a uniform blur.
 */
const buildBands = () => {
  const starts: number[] = [];
  const bandOfRow: number[] = [];
  let row = 0;
  while (row < ROWS_VISIBLE) {
    const size = 2 + Math.floor(hash1(starts.length, 41) * 5); // 2..6 rows
    starts.push(row);
    for (let i = 0; i < size && row < ROWS_VISIBLE; i++, row++) {
      bandOfRow.push(starts.length - 1);
    }
  }
  const ends = starts.map((s, i) => (i + 1 < starts.length ? starts[i + 1] : ROWS_VISIBLE));
  return { starts, ends, bandOfRow, count: starts.length };
};

export const BANDS = buildBands();

/* --------------------------------------------------------------- glitches */

/** 6 bursts across the loop, placed away from the seam. */
const BURSTS: { at: number; width: number; power: number }[] = [
  { at: 0.085, width: 0.011, power: 0.85 },
  { at: 0.243, width: 0.008, power: 1.0 },
  { at: 0.401, width: 0.013, power: 0.7 },
  { at: 0.567, width: 0.009, power: 0.95 },
  { at: 0.742, width: 0.007, power: 1.0 },
  { at: 0.906, width: 0.012, power: 0.8 },
];

/** 0..1 glitch envelope at loop time t. Wraps across the seam. */
export const glitchEnv = (t: number) => {
  let sum = 0;
  for (const b of BURSTS) {
    const d = cyclicDelta(t, b.at) / b.width;
    sum += b.power * Math.exp(-d * d);
  }
  return clamp(sum, 0, 1);
};

/** How much a given band reacts to a burst. */
const susceptibility = (band: number) => 0.35 + 0.65 * hash1(band, 51);

/* ------------------------------------------------------------------ focus */

/**
 * Bands occasionally snap into near-focus for a few frames. Two possible
 * events per band, most of them disabled, so it stays occasional.
 */
export const focusAt = (band: number, t: number) => {
  let f = 0;
  for (let k = 0; k < 2; k++) {
    if (hash1(band, 60 + k) > 0.42) continue;
    const at = hash1(band, 70 + k);
    const width = 0.006 + 0.008 * hash1(band, 80 + k);
    const d = cyclicDelta(t, at) / width;
    f = Math.max(f, Math.exp(-d * d));
  }
  return f;
};

/* ----------------------------------------------------------------- jitter */

/**
 * Horizontal offset of a screen row, in frame pixels. Banded noise, so
 * neighbouring rows move together, plus a small per-row difference and a
 * hard per-frame tear during glitch bursts.
 */
export const rowJitter = (row: number, frame: number, duration: number, layout: Layout) => {
  const t = ((frame % duration) + duration) % duration / duration;
  const band = BANDS.bandOfRow[row];

  const cyclesA = 2 + Math.floor(hash1(band, 12) * 4); // 2..5
  const cyclesB = 6 + Math.floor(hash1(band, 13) * 8); // 6..13
  const ampBand = (0.003 + 0.0102 * hash1(band, 14)) * layout.width;
  const wobble =
    0.66 * loopSin(cyclesA, hash1(band, 15), t) + 0.34 * loopSin(cyclesB, hash1(band, 16), t);

  const rowCycles = 3 + Math.floor(hash1(row, 17) * 10);
  const rowAmp = 0.0022 * layout.width * (0.3 + hash1(row, 18));

  const focus = focusAt(band, t);
  const settle = 1 - 0.88 * focus;

  let x = (ampBand * wobble + rowAmp * loopSin(rowCycles, hash1(row, 19), t)) * settle;

  const g = glitchEnv(t) * susceptibility(band);
  if (g > 0.001) {
    const f = ((frame % duration) + duration) % duration;
    const tear = hash2(row, f, 77) * 2 - 1;
    const drop = hash2(band, f, 78) * 2 - 1;
    x += g * 0.03 * layout.width * (0.65 * tear + 0.35 * drop);
  }
  return x;
};

/* ------------------------------------------------------------------- blur */

/**
 * Horizontal blur sigma for a band, in frame pixels. The visible streak runs
 * to roughly three sigma, so the range below lands at about 60-150px at 4K,
 * with focused bands far tighter and glitch frames far wider.
 */
export const bandBlur = (band: number, frame: number, duration: number, layout: Layout) => {
  const t = ((frame % duration) + duration) % duration / duration;
  const bias = hash1(band, 31);
  const cycles = 1 + Math.floor(hash1(band, 32) * 4);
  const swell = 0.5 + 0.5 * loopSin(cycles, hash1(band, 33), t);
  // Skewed low so a good number of bands stay close to readable while a few
  // are smeared into pure colour bars.
  const n = Math.pow(clamp(0.58 * bias + 0.42 * swell, 0, 1), 1.45);

  let sigma = lerp(0.0012, 0.0145, n) * layout.width;

  // Rows that are moving fast smear further, the way a real display would.
  const row = BANDS.starts[band];
  const v = Math.abs(
    rowJitter(row, frame, duration, layout) - rowJitter(row, frame - 1, duration, layout),
  );
  sigma += v * 0.55;

  const focus = focusAt(band, t);
  sigma = lerp(sigma, 0.0006 * layout.width, focus);

  const g = glitchEnv(t) * susceptibility(band);
  sigma *= 1 + 1.5 * g;

  return clamp(sigma, 0.0006 * layout.width, 0.03 * layout.width);
};

/* ----------------------------------------------------------------- scroll */

/** Upward scroll in pixels. Exactly TOTAL_ROWS rows over the loop. */
export const scrollPx = (frame: number, duration: number, layout: Layout) => {
  const f = ((frame % duration) + duration) % duration;
  return (f / duration) * TOTAL_ROWS * layout.rowHeight;
};

/* ------------------------------------------------------------------ trail */

/**
 * Weights for the trail states, newest first. Normalised so the stack cannot
 * saturate to white: a completely still row sums to just over 1.
 */
export const trailWeights = (() => {
  const decay = 0.68;
  const raw: number[] = [];
  for (let i = 0; i < TRAIL_STATES; i++) raw.push(Math.pow(decay, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => (w / sum) * 1.22);
})();

/** Slow roll bar position, one pass down the frame per loop. */
export const rollBarCentre = (t: number, height: number) => {
  const h = height * 0.22;
  return { y: t * (height + h * 2) - h, h };
};
