/**
 * Timing and format constants for the woven-texture films.
 *
 * Both reference clips are 10.000s of 768x432 @ 60fps, but the motion in them
 * is not continuous: each is a short cycle of macro stills hard-cut on a fixed
 * hold, which is what gives them their "boiling" texture. Measured from the
 * references:
 *
 *   Ref A  50 stills / 600 frames  ->  12-frame hold @60  (5.00 steps/s),
 *                                      5 unique states cycling 10x
 *   Ref B  60 stills / 600 frames  ->  11-frame hold @60  (5.45 steps/s),
 *                                     10 unique states cycling  6x
 *
 * We deliver 30fps, so the holds halve. HOLD_IN_FRAMES is chosen per variant so
 * that DURATION_IN_FRAMES / HOLD_IN_FRAMES is a whole number of states AND a
 * whole number of cycles -- that is what makes the 10s clip seamlessly loopable.
 */

export const FPS = 30;
export const DURATION_IN_SECONDS = 10;
export const DURATION_IN_FRAMES = FPS * DURATION_IN_SECONDS; // 300

/** Delivery master. */
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

/** Archival master shipped as a composition in the project zip. */
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/**
 * The shader is authored against a 1920x1080 reference frame: every length in
 * the presets is in reference pixels, and `resolutionScale` multiplies them so
 * that 4K is the *same framing at higher fidelity* rather than a wider crop.
 */
export const REFERENCE_WIDTH = HD_WIDTH;
