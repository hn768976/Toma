// Timing, sizing and palette for the "floating chat bubbles" background plate.
//
// This is a LIGHT-MODE piece: every element is darker than the background and
// out-of-focus elements wash out toward white, never toward black. There is no
// bloom/glow pass anywhere — adding one would immediately read as wrong.

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// 8.0s. Every periodic quantity below is chosen so that frame 0 and frame 240
// are pixel-identical: wrap cycles are whole numbers, sway periods divide this,
// the gradient path closes, and the grain tile index cycles evenly.
export const DURATION_IN_FRAMES = 240;

// ── Palette ────────────────────────────────────────────────────────────────
export const BG_PALE = "#DCEBFA"; // upper-left, near-white
export const BG_MID = "#A8CCF0"; // centre
export const BG_DEEP = "#5CA0E8"; // lower-right

export const BUBBLE_DEEP = "#1B5FC4"; // nearest bubbles
export const BUBBLE_SOLID = "#2E7FE0"; // the main blue
export const BUBBLE_PALE = "#7FB8F0"; // most distant bubbles
export const BUBBLE_WHITE = "#F0F8FF"; // the text-line detail inside bubbles

// ── Field population ───────────────────────────────────────────────────────
export const BUBBLE_COUNT = 38; // ~35 on screen once wraps are accounted for
export const SPECK_COUNT = 16; // bubbles too distant to resolve

// ── Composition: the right-third cluster ───────────────────────────────────
// The left side is deliberately empty — that is where a title would sit, and
// it is what makes this usable as a background plate. Bubbles never enter the
// left quarter (x < 960).
export const CLUSTER_X_MAX = 3810; // slightly past the right edge, so some clip
export const CLUSTER_X_MIN_NEAR = 2480; // large/near bubbles stay in the right third
export const CLUSTER_X_MIN_FAR = 1620; // only small/far ones stray toward centre
// Exponent > 1 on the seeded position pushes density toward CLUSTER_X_MAX and
// thins it out toward the centre.
export const CLUSTER_BIAS = 1.7;
export const LEFT_QUARTER = WIDTH / 4;

// ── Depth ──────────────────────────────────────────────────────────────────
export const Z_MIN = 0.2;
export const Z_MAX = 1.0;

export const MAX_BUBBLE_WIDTH = 540; // width at z = 1.0
export const MAX_SPECK_SIZE = 42;

// Focus band: only the narrow slice of depth around Z_SHARP is crisp, so
// roughly a quarter of the field is readable at any moment. Everything else
// blurs out — near bubbles because they are past the focal plane, far ones
// because they are behind it.
export const Z_SHARP = 0.55;
export const FOCUS_BAND = 0.1;
export const MAX_BLUR = 26;

export const OPACITY_FAR = 0.3;
export const OPACITY_NEAR = 0.95;

// ── Drift ──────────────────────────────────────────────────────────────────
// Bubbles rise with a slight rightward lean.
export const DRIFT_ANGLE_DEG = 8;
export const DRIFT_LEAN = Math.tan((DRIFT_ANGLE_DEG * Math.PI) / 180);

// Whole wrap cycles completed in one loop, quantised from z so speed stays
// proportional to depth while the loop still closes exactly.
export const MAX_WRAP_CYCLES = 5;

export const SWAY_AMPLITUDE = 15; // px
// Every entry divides DURATION_IN_FRAMES.
export const SWAY_PERIODS = [240, 120, 80, 60, 48, 40];
export const TILT_SWAY_DEG = 3;

// ── Motion blur ────────────────────────────────────────────────────────────
// At 30fps the fast near bubbles strobe without it. Only worth paying for
// above this depth; slower distant bubbles do not need it.
export const MOTION_BLUR_MIN_Z = 0.6;
export const MOTION_BLUR_SAMPLES = 4;
// Relative alpha of each smear sample, leading edge first.
export const MOTION_BLUR_WEIGHTS = [0.64, 0.2, 0.1, 0.05];
// Fraction of one frame's travel the smear spans.
export const MOTION_BLUR_SPAN = 0.85;

// ── Background motion & finish ─────────────────────────────────────────────
export const GRADIENT_DRIFT = 110; // px the light region travels on its closed path
export const HIGHLIGHT_STRENGTH = 0.34; // upper-left overexposure lift
export const VIGNETTE_STRENGTH = 0.06; // warm, not dark
export const GRAIN_ALPHA = 0.03;
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 6; // divides DURATION_IN_FRAMES
