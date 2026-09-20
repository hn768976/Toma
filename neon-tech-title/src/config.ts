/**
 * Global timing + format constants.
 *
 * These are measured directly from the two reference clips:
 *   283 samples, stts delta 512 @ timescale 15360  ->  exactly 30 fps
 *   283 / 30 = 9.4333s
 *
 * The reference titles type themselves in, hold, erase and restart exactly
 * three times over the clip, which is what makes the clip loop: the typing
 * period is DURATION_IN_FRAMES / 3.
 */
export const FPS = 30;
export const DURATION_IN_FRAMES = 283;

export const WIDTH_1080 = 1920;
export const HEIGHT_1080 = 1080;
export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

/** Number of type-on / hold / erase cycles across the loop. */
export const TYPE_CYCLES = 3;

/** 283 / 3 = 94.333 frames per typing cycle. */
export const CYCLE_FRAMES = DURATION_IN_FRAMES / TYPE_CYCLES;
