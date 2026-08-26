// Second plate: the palette of the first one inverted. White social icons on a
// saturated azure field, spread across the whole frame rather than clustered.
//
// Every colour and rate below was sampled off the reference clip rather than
// guessed: the flat ground reads #448AEA, the soft centre disc #3784F0 (deeper
// and bluer than the ground, not lighter), icon bodies land around #EDEEF0, and
// the bars inside the bubbles are the same blue family as the ground.

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 240;

export const BG_BASE = "#448AEA";
export const BG_DISC = "#3784F0";
export const ICON_WHITE = "#EDEEF0";
export const ICON_WHITE_COOL = "#F7F9FB";
export const BAR_BLUE = "#4287EE";
export const SHADOW_COLOR = "rgba(46, 92, 164, 0.34)";

// ~38 icons on screen at any moment, in the reference's rough 57/43 split of
// message bubbles to like badges.
//
// If you change these, re-check the strides in icons.ts: they have to stay
// coprime with ICON_COUNT or the stratified slots stop being a permutation.
export const BUBBLE_COUNT = 24;
export const BADGE_COUNT = 18;
export const ICON_COUNT = BUBBLE_COUNT + BADGE_COUNT;

export const MAX_BUBBLE_WIDTH = 420;
export const MAX_BADGE_SIZE = 230;

export const Z_MIN = 0.18;
export const Z_MAX = 1;
export const Z_SHARP = 0.5;
export const FOCUS_BAND = 0.16;
export const MAX_BLUR = 17;

/**
 * Focus falls off far more gently behind the band than in front of it. In the
 * reference the small distant icons stay legible and it is the big near ones
 * flying past the lens that go soft; blurring both ends equally erased the far
 * field altogether, since a 9px blur on a 75px-wide icon is most of it.
 */
export const FAR_BLUR_SCALE = 0.3;

export const OPACITY_FAR = 0.7;
export const OPACITY_NEAR = 1;

/**
 * Fitting a global zoom to the reference barely beat the identity transform
 * (rms 24.3 against 27.2), so the clip is not a dolly — it is per-icon parallax
 * drift. What the fit did pin down is the rate: about 12% of frame height per
 * second upward. One whole traversal per 8s loop lands almost exactly there, so
 * most icons take a single wrap cycle and only the near tier takes two.
 */
export const FAST_TIER_Z = 0.68;
export const FAST_TIER_CYCLES = 2;

/** dx/dy of the drift. The reference is near-vertical, so barely any lean. */
export const DRIFT_LEAN = 0.05;

// Only the two-cycle tier moves fast enough to strobe at 30fps.
export const MOTION_BLUR_MIN_Z = FAST_TIER_Z;
export const MOTION_BLUR_SAMPLES = 3;
export const MOTION_BLUR_SPAN = 1;
export const MOTION_BLUR_WEIGHTS = [0.62, 0.26, 0.12];

export const SWAY_PERIODS = [240, 120, 80, 60, 48] as const;
export const SWAY_MIN = 6;
export const SWAY_MAX = 14;
export const TILT_SWAY_DEG = 3;

// Keep icons off the extreme edges so nothing is half-cropped for the whole loop.
export const MARGIN_X = 0.035;

// The soft disc sitting behind everything, measured off the reference at
// roughly 0.23 of frame width in radius, a touch left of and below centre.
export const DISC_CENTER_X = 0.48;
export const DISC_CENTER_Y = 0.52;
export const DISC_RADIUS = 0.245;
export const DISC_DRIFT = 70;

export const GRAIN_ALPHA = 0.03;
export const GRAIN_TILE_SIZE = 256;
export const GRAIN_TILE_COUNT = 6;
