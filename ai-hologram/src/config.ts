/**
 * Composition-level constants.
 *
 * The composition is authored at 4K. Every size in the scene is expressed in
 * world units (three.js) or as a fraction of the frame via `useVideoConfig()`,
 * so a `--scale=0.5` 1080p preview is pixel-for-pixel the same framing as the
 * full 4K render.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s

/** Master seed. Every random layout in the scene derives from this. */
export const SEED = 0x51de_c0de;
