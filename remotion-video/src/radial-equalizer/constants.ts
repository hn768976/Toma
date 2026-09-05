/**
 * Radial Audio Equalizer — shared constants.
 *
 * The composition is authored at 4K so it can be rendered at full size later;
 * every dimension below is expressed as a fraction of the frame *height* so
 * the artwork is resolution independent (see `useVideoConfig()` in the
 * component).
 */

export const TAU = Math.PI * 2;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;
export const FPS = 30;
/** 12 seconds. Every periodic term below divides evenly into this. */
export const DURATION_IN_FRAMES = 360;

/** Synthetic spectrum resolution. Also the number of spikes in the core ring. */
export const NUM_BANDS = 96;

/** Beat every 36 frames => 10 beats across the loop (360 / 36). */
export const BEAT_INTERVAL = 36;
/** Length of the snap-back envelope, in frames. */
export const BEAT_DECAY = 8;
/** How much the whole assembly expands on the beat. */
export const BEAT_EXPANSION = 0.03;

/** Whole-field rotation, in turns per loop. Must be an integer to close. */
export const ROTATION_TURNS = 1;

/** Concentric ring cells between R_MIN and R_MAX. */
export const RINGS = 10;
/** Inner edge of the travelling field, in frame heights. */
export const FIELD_R_MIN = 0.15;
/** Outer edge, pushed well past the frame corners so recycling is off-screen. */
export const FIELD_R_MAX = 1.34;
/** >1 spaces rings further apart as they go out, so elements accelerate. */
export const RADIAL_POWER = 1.15;

/** Core cluster: ~6% of frame height across. */
export const CORE_RADIUS = 0.03;
export const CORE_DOTS = 460;
export const SPIKE_INNER = 0.034;
export const SPIKE_MIN_LEN = 0.012;
export const SPIKE_MAX_LEN = 0.078;

/** Colour buckets used to batch draws: 2 hue families x 24 brightness steps. */
export const RAMP_STEPS = 24;
export const COLOR_BUCKETS = RAMP_STEPS * 2;

/** Softness tiers used to fake radial blur without a per-element filter. */
export const SOFTNESS_LEVELS = 3;

/** Grain tiles are cycled by frame; 12 divides 360 so the grain loops too. */
export const GRAIN_TILES = 12;
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_STRENGTH = 0.02;
