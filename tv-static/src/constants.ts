/**
 * Composition constants.
 *
 * The compositions are DEFINED at 4K so they can be rendered at 3840x2160
 * later. Preview/1080p renders use `--scale=0.5`; the noise is always
 * generated at the true output pixel size, never scaled up.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

/**
 * Features that are *not* pixel-scale phenomena (streak run lengths,
 * chromatic offsets, scanline pitch) are sized relative to this width so a
 * 4K frame reads the same as a 1080p one. The base speckle deliberately does
 * NOT scale — see README.
 */
export const REFERENCE_WIDTH = 1920;
