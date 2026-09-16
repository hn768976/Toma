// Timing, camera, grid and wave configuration for the abstract digital
// particle-wave background.
//
// Everything here is authored at 1x (1920x1080). Pixel-valued numbers are
// multiplied by `resolutionScale` in geometry.ts so the 4K composition is a
// pixel-exact 2x enlargement of the 1080p one rather than a different-looking
// render. Counts (COLS/ROWS) deliberately do NOT scale: the grid is a fixed
// structure, so 4K must show the same lattice, only sharper.

export const FPS = 30;

// The reference clip is 15.015s @ 29.97fps. At the requested 30fps the
// nearest whole-frame match is 450 frames = 15.000s.
export const DURATION_IN_FRAMES = 450;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Grid ------------------------------------------------------------------
// Number of particle columns/rows on the surface. Column spacing reads wider
// than row spacing, which is what gives the reference its "dotted vertical
// strands" character.
export const COLS = 130;
export const ROWS = 125;

// Half-extent of the surface in world units, before perspective.
export const X_EXTENT = 3600;
export const Y_EXTENT = 1150;

// --- Camera ----------------------------------------------------------------
// Pinhole camera at the origin looking down +Z. At Z = PLANE_DISTANCE the
// projection is 1:1, so world units == screen pixels in the centre of frame.
export const FOCAL = 1000;
export const PLANE_DISTANCE = 1000;

// The surface is not flat: it bows away from the camera towards its left/right
// edges (and slightly top/bottom). CURVE_X is tuned so the silhouette fold —
// where the bowing surface turns away and the columns pile up — lands right at
// the frame edge, which is the curling, compressed edge seen in the reference.
export const CURVE_X = 2000;
export const CURVE_Y = 340;

// --- Wave ------------------------------------------------------------------
// A wave term is amp * sin(PI*ku*u + PI*kv*v + n*theta), where u/v are the
// normalised surface coordinates and theta = 2*PI*frame/DURATION_IN_FRAMES.
// `n` MUST be a whole number: that is what makes the last frame land exactly
// back on frame 0, i.e. what makes the loop seamless.
export type WaveTerm = { amp: number; ku: number; kv: number; n: number };

// Depth displacement — the dominant motion. Perspective turns it into the
// swelling/receding ripple that runs through the columns.
export const Z_WAVE_TERMS: WaveTerm[] = [
  { amp: 0.55, ku: 1.5, kv: 0.8, n: 2 },
  { amp: 0.28, ku: -2.3, kv: 1.4, n: 3 },
  { amp: 0.2, ku: 0.9, kv: -2.0, n: -1 },
  { amp: 0.12, ku: 3.1, kv: 0.5, n: 4 },
];
export const Z_AMPLITUDE = 430;

// Lateral + vertical displacement — small, but it is what makes the strands
// snake instead of staying ruler-straight.
export const X_WAVE_TERMS: WaveTerm[] = [
  { amp: 0.55, ku: 1.0, kv: 1.8, n: -2 },
  { amp: 0.3, ku: -2.0, kv: 0.9, n: 3 },
  { amp: 0.15, ku: 1.4, kv: 3.6, n: -1 },
];
export const X_AMPLITUDE = 58;

// Vertical displacement is what bunches dots together along a column: where
// the gradient compresses them they overlap and additive blending fuses them
// into the bright dashed strands that give the reference its texture.
export const Y_WAVE_TERMS: WaveTerm[] = [
  { amp: 0.5, ku: 1.7, kv: 1.2, n: 1 },
  { amp: 0.3, ku: -1.1, kv: 2.4, n: -3 },
  { amp: 0.2, ku: 2.6, kv: 4.2, n: 2 },
];
export const Y_AMPLITUDE = 88;

// --- Look ------------------------------------------------------------------
export const BASE_DOT_RADIUS = 1.5; // dot radius at PLANE_DISTANCE, in px @1x

// Master exposure on the *colour* ramp. Without it the brightness stack
// (depth * fog * twinkle * key light * per-particle variation) saturates for
// most of the lattice and every dot clips to the white end of the ramp; this
// holds the body of the field in the saturated blue mid-tones and lets only
// crests blow out.
export const MASTER_GAIN = 0.58;

// Opacity is derived from the same energy but on its own curve, so a particle
// can be solidly visible while still sitting low on the colour ramp. Coupling
// the two directly forces a choice between "bright but white" and "blue but
// invisible"; the gamma lifts the dim end without touching hue selection.
export const ALPHA_GAMMA = 0.55;
export const ALPHA_GAIN = 1.5;

// Fake depth-of-field. Distance from FOCUS_Z inflates a dot's radius and
// drops its alpha to match, so out-of-focus particles smear instead of
// staying pin-sharp — the soft, defocused frame edges of the reference.
export const FOCUS_Z = 1150;
export const BOKEH_PER_UNIT = 0.0018; // extra radius px per unit of |Z - FOCUS_Z|
export const BOKEH_ALPHA_FALLOFF = 1.5;

// Atmospheric falloff: e^(-(Z - PLANE_DISTANCE) / FOG_DISTANCE).
export const FOG_DISTANCE = 1400;

// Per-particle twinkle. Whole-number cycle count keeps the loop seamless.
export const SHIMMER_CYCLES = 3;
export const SHIMMER_DEPTH = 0.22;

// Key light sitting just above the top edge, slightly right of centre —
// matches the bright bloom in the reference. Position is a fraction of the
// frame, radius a fraction of the width.
export const LIGHT_X = 0.52;
export const LIGHT_Y = -0.04;
export const LIGHT_RADIUS = 0.5;
export const LIGHT_GAIN = 0.62;

export const BASE_BLUR_PX = 13; // bloom-layer blur radius, in px @1x
export const BLOOM_OPACITY = 0.9;

// Bloom is drawn from a downscaled copy of the particle pass: blurring a
// quarter-size canvas looks the same once it is scaled back up and keeps 4K
// renders from spending most of their time in the blur filter.
export const BLOOM_DOWNSCALE = 4;
