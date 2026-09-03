/**
 * Composition-level constants. These are fixed for all three variants: the
 * overlays are 4K, 30fps, and loop over exactly 900 frames.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

/**
 * 900 frames = 30.0s. Every periodic motion in the project is built from an
 * integer number of cycles of this length, so frame 900 reproduces frame 0
 * exactly and the clip can be looped under a cut without a visible seam.
 */
export const LOOP_FRAMES = 900;

/** Angular frequency of one whole loop, in radians per frame. */
export const LOOP_OMEGA = (Math.PI * 2) / LOOP_FRAMES;
