// Timing, palette and density config for the starry-night treeline.
//
// The composition is authored at 4K (3840x2160) and rendered down with
// `--scale`, so every size below is either an absolute 4K pixel value or a
// fraction of the frame — never a hard 1080p number.

export const FPS = 30;

// 30s loop. Every periodic value in this composition (twinkle cycles, tree
// sway, the V2 moon breathing, the grain tile cycle) has a period that
// divides DURATION_IN_FRAMES evenly so frame 900 lines up with frame 0.
export const DURATION_IN_FRAMES = 900;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Sky -------------------------------------------------------------------
// The reference sky is *bluer at the top* and deepens toward the horizon,
// which is the opposite of a daytime gradient.
export const SKY_TOP = "#0a2a5c";
export const SKY_HORIZON = "#030b1e";

// --- Milky Way -------------------------------------------------------------
// A broad faint band from upper-left down toward centre-right. Endpoints are
// pushed outside the frame so the band runs edge to edge.
export const BAND_START = { x: -0.06, y: -0.06 };
export const BAND_END = { x: 1.06, y: 0.62 };
export const BAND_HALF_WIDTH = 0.3; // fraction of frame height
export const BAND_OPACITY = 0.085; // low contrast — a suggestion, not a feature
export const BAND_CORE_COLOR = [172, 160, 208] as const; // slight violet cast
export const BAND_EDGE_COLOR = [202, 214, 240] as const;
// Milky Way is evaluated on a downscaled buffer and drawn back up smoothed.
export const BAND_BUFFER_DIVISOR = 8;

// --- Stars -----------------------------------------------------------------
export const STAR_COUNT = 5000;
export const BRIGHT_STAR_COUNT = 30;
export const DIFFRACTION_STAR_COUNT = 4;
// Fraction of stars that twinkle. These are excluded from the pre-rendered
// starfield and redrawn per frame; everything else is drawn exactly once.
export const TWINKLE_FRACTION = 0.065;
// Twinkle cycle lengths in frames. All divide DURATION_IN_FRAMES.
export const TWINKLE_PERIODS = [150, 180, 225, 300, 450] as const;
// Stars are only generated above this line — anything lower is hidden by the
// treeline anyway.
export const STAR_FIELD_BOTTOM = 0.84;

// --- Treeline --------------------------------------------------------------
// Three depth tiers, lifting away from pure black as they recede.
export const NEAR_COLOR = "#000000";
export const MID_COLOR = "#03070f";
export const FAR_COLOR = "#070d1a";
export const FAR_BLUR = 0.003; // fraction of frame height
// The ground under the ridge sits darker than the far trees, so the horizon
// reads as a treeline rather than as a bank of fog.
export const GROUND_COLOR = "#050a15";

// The horizon under the far tier is not flat: a gentle rise toward the left.
export const HORIZON_BASE = 0.905;
export const HORIZON_RISE = 0.03;

// Near-tier sway: a fraction of a degree at the crown, on long staggered
// cycles. Periods divide DURATION_IN_FRAMES.
export const SWAY_PERIODS = [900, 450, 300] as const;
export const SWAY_MAX_DEGREES = 0.28;

// --- V2 moonrise -----------------------------------------------------------
export const MOON_CENTER = { x: 0.79, y: 0.94 }; // just below the treeline, right
export const MOON_RADIUS = 0.44; // fraction of frame height
export const MOON_OPACITY = 0.55;
export const MOON_COLOR = [206, 224, 255] as const;
export const MOON_BREATH_PERIOD = 450; // frames
export const RIM_COLOR = "rgba(152,184,232,0.18)";
export const RIM_OFFSET = 0.003; // fraction of frame height

// --- Finishing -------------------------------------------------------------
// Large smooth sky gradients band badly in H.264; the grain doubles as a
// dither. Tiles are cycled rather than scrolled so the loop stays seamless.
export const GRAIN_TILE_SIZE = 1024;
export const GRAIN_TILE_COUNT = 10; // divides DURATION_IN_FRAMES
export const GRAIN_AMPLITUDE = 0.045;

export const VIGNETTE_COLOR = "rgba(2,4,10,0.42)";

export const DEFAULT_SEED = 20260904;
