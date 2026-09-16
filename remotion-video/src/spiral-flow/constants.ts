/**
 * Timing + format constants for the "Spiral Flow" 3D loop.
 *
 * The brief locks these to the client reference clip:
 *   reference = 768x432, 25 fps, exactly 6.000 s (150 frames)
 * Retimed to the requested 30 fps that is 180 frames, still exactly 6.000 s.
 */

export const FPS = 30;

/** 6.000 s at 30 fps — identical runtime to the reference clip. */
export const DURATION_IN_FRAMES = 180;

/** Mastering resolution. All deliverables are downscales of this. */
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/** Preview / delivery resolution. */
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
