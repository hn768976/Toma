/** Composition is authored at 4K; the 1080p preview is the same thing at --scale=0.5. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 20s at 30fps. The globe turns exactly 360 deg over this span, so the clip loops. */
export const DURATION_IN_FRAMES = 600;

/**
 * Every size in this project is authored as "pixels at 4K" and converted to a
 * fraction of frame height before it reaches a shader, so the 1080p preview is
 * an exact scale model of the 4K render.
 */
export const REFERENCE_HEIGHT = HEIGHT;
export const px4k = (px: number): number => px / REFERENCE_HEIGHT;
