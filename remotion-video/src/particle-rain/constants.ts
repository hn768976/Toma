// Timing, geometry and look configuration for the particle-rain loop.
// Everything the animation reads is here; the draw code has no magic
// numbers of its own.

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** 10.0s. Every periodic quantity below divides into this so frame 0 and
 *  frame 300 are pixel-identical. */
export const DURATION_IN_FRAMES = 300;

// Four things vary per variant and live in variants.ts instead: flow
// direction, lean angle, base fall speed, and the source-glow position.
// Everything below is shared by every variant.

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

export const STREAM_COUNT = 120;

/** Streams are seeded across a band wider than the frame: the shared lean
 *  slides a column sideways by up to ~400px between top and bottom, so the
 *  band has to overhang or the corners go bald. */
export const STREAM_OVERSCAN = 0.13;

/** How far a stream may wander from its evenly-spaced slot, in slot widths.
 *  This is what turns a regular grid into clusters and gaps. */
export const STREAM_CLUSTER_SPREAD = 2.6;

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

export const Z_MIN = 0.2;
export const Z_MAX = 1.0;

/** Depth at which streams are perfectly sharp. Blur ramps up on both sides
 *  of it, so the far and near extremes are both soft. */
export const SHARP_Z = 0.55;

/** Blur ceiling at 4K, hit at the near extreme (z = 1). */
export const BLUR_MAX_PX = 20;

/** Shapes the sharp band: >1 keeps a wider stretch of the middle crisp. */
export const BLUR_FALLOFF = 1.6;

export const ALPHA_FAR = 0.25;
export const ALPHA_NEAR = 1.0;

/** Streams nearer than this get the three-tap motion blur. */
export const MOTION_BLUR_Z = 0.7;

/** Alphas of the three motion-blur taps, leading tap first. They sum to 1 so
 *  a smeared dot carries the same total light as a still one. */
export const MOTION_BLUR_TAP_ALPHAS = [0.5, 0.32, 0.18];

// ---------------------------------------------------------------------------
// Dots
// ---------------------------------------------------------------------------

export const DOT_MIN_SIZE_PX = 3;
export const DOT_MAX_SIZE_PX = 9;

/** Per-dot multiplier on the depth-derived size. */
export const DOT_SIZE_VARIANCE = { min: 0.55, max: 1.15 };

/** Mean gap between dots along a stream, before the per-stream density and
 *  per-gap jitter below. */
export const DOT_SPACING_PX = 40;

/** Per-stream density multiplier. The wide range is deliberate: low values
 *  read as dashed trails, high values as dense runs. */
export const STREAM_DENSITY = { min: 0.55, max: 1.9 };

/** Per-gap jitter multiplier, so spacing also varies *within* a stream. */
export const DOT_GAP_JITTER = { min: 0.35, max: 1.75 };

/** Sideways scatter of a dot off its stream axis, in px. Re-rolled each time
 *  the dot wraps. */
export const DOT_LATERAL_JITTER_PX = 2.5;

// ---------------------------------------------------------------------------
// Wrapping
// ---------------------------------------------------------------------------

/** How far past each edge a dot travels before it wraps, so the re-roll on
 *  wrap always happens off-screen. */
export const WRAP_MARGIN_PX = 90;

// ---------------------------------------------------------------------------
// Twinkle and flares
// ---------------------------------------------------------------------------

/** Every period divides DURATION_IN_FRAMES, so twinkle is seamless. */
export const TWINKLE_PERIODS = [50, 60, 75, 100, 150];

export const TWINKLE_AMPLITUDE = 0.18;

/** Dots that flash to `dotWhite` per second. */
export const FLARES_PER_SECOND = 6;

export const FLARE_MIN_FRAMES = 3;
export const FLARE_MAX_FRAMES = 4;

/** Size multiplier at the peak of a flare. */
export const FLARE_SIZE_BOOST = 1.6;

// ---------------------------------------------------------------------------
// Source glow
// ---------------------------------------------------------------------------

/** The source glow feeds the bloom pass at reduced strength — it is already
 *  a soft gradient, and blooming it at full strength washes the frame. */
export const SOURCE_GLOW_BLOOM_SCALE = 0.45;

/** How far the lifted navy pools out from the source, and how strongly. */
export const BACKGROUND_POOL = { radiusFraction: 0.75, strength: 0.8 };

/** Master multiplier on every glow halo and on the source glow. */
export const GLOW_STRENGTH = 1;

// ---------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------

/** Bloom is built by drawing the bright dots into a small buffer, blurring
 *  it and adding it back — cheap, and the upscale does most of the spread. */
export const BLOOM_DOWNSCALE = 6;
export const BLOOM_BLUR_PX = 5;
export const BLOOM_ALPHA = 0.42;
export const BLOOM_SIZE_BOOST = 2.4;
/** Only dots at least this bright contribute to bloom. */
export const BLOOM_THRESHOLD = 0.5;

export const VIGNETTE_STRENGTH = 0.2;

export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_PX = 384;

/** Ambient drift: the frame breathes around a closed ellipse, ±10px, one
 *  full revolution per loop. */
export const DRIFT_AMPLITUDE_PX = 10;
