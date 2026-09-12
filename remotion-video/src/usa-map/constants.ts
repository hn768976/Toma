// Timing and framing for the North America data-map.
//
// Every geometric value is authored at 1x (1080p) and multiplied by the
// composition's resolutionScale at draw time, so the 1080p and 4K
// compositions are pixel-proportional rather than merely upscaled.

export const FPS = 30;

/** 10.00s at 30fps — matches the reference clip exactly. */
export const DURATION_IN_FRAMES = 300;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Camera pose -----------------------------------------------------------
// Angles in degrees; converted once in the component.

/** Camera elevation above the plane. 90 would be straight down. */
export const PITCH_DEG = 50;
/** Rotation of the map under the camera. */
export const YAW_DEG = -7;
/** Screen roll, tipping the graticule slightly off-level. */
export const ROLL_DEG = 3.2;

/** Look-at point in map space (roughly the US interior). */
export const TARGET_X = 40;
export const TARGET_Y = 30;

/** Camera distance at the start of the move, in map units. */
export const DIST_START = 1900;
/** Slow push-in over the 10s. */
export const DIST_END = 1748;

/** Focal length as a multiple of the 1080p frame height. */
export const FOCAL_FACTOR = 1.636;

/** The look-at point sits below frame centre so Canada fills the far field. */
export const CENTER_Y_FACTOR = 0.45;
export const CENTER_X_FACTOR = 0.585;

/** Lateral drift across the clip, in map units. */
export const DRIFT_X = 52;
export const DRIFT_Y = 22;

// --- Look ------------------------------------------------------------------

/** Land dot diameter as a fraction of the projected lattice pitch. */
export const DOT_FILL = 0.32;
/** Bloom: source is rendered at 1/N and blurred back over the frame. */
export const BLOOM_DOWNSCALE = 4;
export const BLOOM_BLUR_PX = 6.5;
export const BLOOM_STRENGTH = 0.55;

/** Cities quieter than this never emit ping rings, to keep the map calm. */
export const PING_MIN_WEIGHT = 0.56;
export const PING_PERIOD = 150;
