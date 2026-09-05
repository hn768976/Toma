// Geometry, timing and look configuration for the "Halftone Dot Wave".
//
// Everything here is expressed in *composition pixels* at the 3840x2160
// master size. The compositions are always defined at 4K; a 1080p preview
// is produced with `--scale=0.5`, which downsamples the whole page and so
// keeps the dot grid identical in layout at both resolutions.

export const FPS = 30;
export const DURATION_IN_FRAMES = 480; // 16s

export const WIDTH = 3840;
export const HEIGHT = 2160;

// --- The dot grid -------------------------------------------------------

export const COLS = 120;
// A few more rows than the ~60 the look calls for, so the near end of the
// sheet still runs off the bottom edge when a crest lifts it.
export const ROWS = 68;

// --- Baked projection ---------------------------------------------------
//
// The sheet is not raytraced: it is a grid mapped through a fixed shallow
// projection. The row index alone drives scale, spacing and alpha, exactly
// as a locked camera on a tilted plane would, and the whole projected sheet
// is then rotated so it sweeps diagonally across the frame.
//
// Sheet space has its origin on the horizon line, x running across the
// sheet and y running *down* toward the viewer.

/** Half-width of the far (top) row, in sheet-space px. */
export const SPREAD_HALF_FAR = 2380; // -> 40px column spacing at 4K, 20px at 1080p
/** Perspective strength: the near row is 1/(1-PERSPECTIVE) times wider. */
export const PERSPECTIVE = 0.5; // near row is exactly 2x the far row
/** Spacing between the far two rows, in sheet-space px. */
export const ROW_STEP = 26;

/** Rotation of the projected sheet, radians. Negative tilts it up to the right. */
export const SHEET_ANGLE = (-19 * Math.PI) / 180;
/** Where the horizon origin lands on the frame. */
export const HORIZON_X = 1920;
export const HORIZON_Y = 820;

// --- The travelling wave ------------------------------------------------

/** Wavelengths of the primary fold along the sheet's length. */
export const WAVE_COUNT = 1.75;
/** Skew of the fold ridge across the sheet, in wavelengths. */
export const WAVE_SKEW = 0.8;
export const WAVE_AMPLITUDE = 0.62;

/** A second travelling wave at a different frequency, for richer folds. */
export const WAVE2_COUNT = 0.85;
export const WAVE2_SKEW = -0.9;
export const WAVE2_AMPLITUDE = 0.28;

/**
 * Very slight looping "breathing" of the overall sheet shape. Each term
 * completes a whole number of cycles over DURATION_IN_FRAMES, so the sum
 * is exactly periodic over the loop.
 */
export const BREATH_TERMS: {
  amp: number;
  cycles: number;
  phase: number;
  kx: number;
  ky: number;
}[] = [
  { amp: 0.06, cycles: 1, phase: 0.13, kx: 0.7, ky: 0.35 },
  { amp: 0.035, cycles: 2, phase: 0.61, kx: -0.45, ky: 0.9 },
  { amp: 0.022, cycles: 3, phase: 0.28, kx: 1.3, ky: -0.6 },
];

/** Vertical gain of the fold, in sheet-space px at the far row. */
export const HEIGHT_GAIN = 160;

/** Row-expansion values that map to a fully turned-away / fully facing
 *  surface. 1.0 is a flat sheet; see facingAt(). */
export const FACING_LO = 0.2;
export const FACING_HI = 1.8;

// --- Halftone dots ------------------------------------------------------

/** Dot diameter as a fraction of the local column spacing, at the extremes
 *  of the fold. MAX is "near touching"; MIN is where the grid opens up. */
export const DOT_MIN = 0.2;
export const DOT_MAX = 0.92;

/** Per-dot positional jitter, as a fraction of the local spacing. Breaks up
 *  interference between the regular grid and the pixel grid at 4K. */
export const JITTER = 0.025; // +/- 2.5%, i.e. under 3%
export const JITTER_SEED = 0x5eed_1a2b;

/** Alpha at the far end vs. the near end of the projection. */
export const ALPHA_FAR = 0.22;
export const ALPHA_NEAR = 1;
/** How much of a dot's alpha is driven by the surface facing the viewer. */
export const FACING_ALPHA = 0.62;
/** Extra brightness on the crests of the fold. */
export const CREST_GAIN = 0.8;
/** Rows over which the sheet fades in from the horizon, so its far edge
 *  never reads as a hard line. */
export const HORIZON_FADE_ROWS = 8;

// --- Batching -----------------------------------------------------------

/** Colour buckets along the sheet's length. Dots are grouped by
 *  (bucket, intensity level) so each group is a single fillStyle + fill(). */
export const COLOR_BUCKETS = 48;
/** Bias applied to the row position before the colour lookup. Below 1 it
 *  pulls the near-end hue further up the sheet, so the magenta / cyan end
 *  of the ramp reads across the visible near half rather than just the
 *  bottom corner. */
export const COLOR_BIAS = 0.75;
export const LEVEL_BUCKETS = 16;

// --- Glow, bloom and grain ---------------------------------------------

/** Centre of the wide background glow, in sheet space. */
export const GLOW_X = 260;
export const GLOW_Y = 1180;
export const GLOW_RADIUS = 1500;
export const GLOW_ALPHA = 0.2;

/** The bloom pass is a blurred copy of the dot layer, masked to the dense
 *  region only. Heavy bloom fuses the dots and destroys the halftone. */
export const BLOOM_DOWNSCALE = 6;
export const BLOOM_BLUR_PX = 26; // in downscaled px
export const BLOOM_OPACITY = 0.38;

export const GRAIN_TILE = 512;
export const GRAIN_AMOUNT = 0.015; // ~1.5%
export const GRAIN_SEED = 0x9e37_79b9;
