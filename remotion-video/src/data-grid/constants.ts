// Timing and camera geometry for the "big data" grid field.
//
// Modelled on a 20.00s @ 30fps 16:9 reference clip. The reference's
// motion was measured by scale-space cross-correlation between frames
// 0.5s-2.0s apart: it is a *uniform radial zoom* about frame centre of
// 1.032x per second (consistent to within 0.5% across all intervals),
// not a wide-depth perspective fly-through. The camera below reproduces
// that exactly.
//
// Every size here is in *base* pixels (a virtual 1920x1080 frame) and is
// multiplied by a resolution scale at render time, so the 4K
// composition is a true 2x render rather than an upscale.

export const FPS = 30;
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const DURATION_IN_SECONDS = 20;
export const DURATION_IN_FRAMES = DURATION_IN_SECONDS * FPS; // 600

export const CENTER_X = BASE_WIDTH / 2;
export const CENTER_Y = BASE_HEIGHT / 2;

/** Measured from the reference. */
export const ZOOM_PER_SECOND = 1.0323;
export const LOG_ZOOM_PER_FRAME = Math.log(ZOOM_PER_SECOND) / FPS;

/**
 * Elements ride a zoom band: they enter small at the centre, drift
 * outward as the zoom grows, then recycle. Running a whole number of
 * bands over the clip is what makes the export loop — frame 600 lands
 * back exactly on frame 0.
 */
export const ZOOM_CYCLES = 4;
export const CYCLE_FRAMES = DURATION_IN_FRAMES / ZOOM_CYCLES; // 150
export const BAND_LOG = LOG_ZOOM_PER_FRAME * CYCLE_FRAMES;
export const ZOOM_MAX = Math.exp(BAND_LOG); // ~1.172

/** Fractions of a band spent fading in at the start and out at the end. */
export const FADE_IN = 0.18;
export const FADE_OUT = 0.22;

// A slow parallax drift so the field is never perfectly static. Whole
// numbers of periods, again for the loop.
export const DRIFT_X_AMPLITUDE = 30;
export const DRIFT_Y_AMPLITUDE = 14;
export const DRIFT_X_PERIODS = 1;
export const DRIFT_Y_PERIODS = 2;

/**
 * Barrel bow. Horizontal grid lines sag toward the optical centre by
 * CURVE/2 of their offset at mid-frame; every element is warped with the
 * same curve, so dots and readouts keep sitting exactly on the lines.
 */
export const CURVE = 0.12;

/** How far outside the frame an element may sit before it is culled. */
export const CULL_MARGIN = 0.1;

/**
 * Extents elements are seeded across, in base pixels at zoom 1 (the
 * bottom of the band). Slightly wider than the frame so the edges stay
 * populated as the field flows outward.
 */
export const FIELD_HALF_X = 1010;
export const FIELD_HALF_Y = 580;

// Element counts, matched to the reference's on-screen density.
export const NODE_COUNT = 430;
export const READOUT_COUNT = 150;
export const DASH_COUNT = 165;
export const BLOCK_COUNT = 16;

// Grid lines. The reference's spacing is irregular rather than a regular
// lattice, so offsets are evenly spread and then jittered, and each line
// carries its own band phase so lines recycle independently.
export const GRID_VERTICALS = 26;
export const GRID_HORIZONTALS = 18;

/** The pool of readout values, transcribed from the reference clip. */
export const READOUT_VALUES = [
  "875.73", "271.85", "904.59", "618.19", "405.06", "486.10", "226.34",
  "604.87", "724.75", "245.21", "698.11", "431.70", "937.89", "714.93",
  "125.32", "543.82", "457.23", "385.08", "484.98", "500.53", "587.11",
  "255.20", "529.39", "428.37", "576.23", "365.08", "738.07", "139.75",
  "168.61", "924.56", "774.72", "816.00", "831.32", "951.21", "312.92",
  "445.02", "947.89", "861.30", "711.43", "745.85", "846.87", "716.99",
  "178.60", "615.97", "399.51", "818.01", "731.42", "211.91", "884.60",
  "776.04", "447.23", "911.24", "791.36", "183.04", "358.21", "641.66",
  "933.46", "572.68", "284.06", "471.66", "137.66", "628.40", "990.12",
] as const;
