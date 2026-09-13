/**
 * Master timing + geometry config.
 *
 * Everything in the scene is authored in a fixed 3840x2160 "design space" and
 * then uniformly scaled to whatever the composition resolution happens to be.
 * That is what lets the exact same component tree render identically at 4K and
 * at 1080p — only the pixel grid changes, never the layout.
 */
export const DESIGN_WIDTH = 3840;
export const DESIGN_HEIGHT = 2160;

export const FPS = 30;

/**
 * The reference clip is 11.04s at 29.97fps. At a clean 30fps the closest
 * whole-frame match is 331 frames = 11.033s.
 */
export const DURATION_IN_FRAMES = 331;
