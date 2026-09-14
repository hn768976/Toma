// Shared sizing for both grid-plane videos.
//
// Every scene is authored against this 1920x1080 design box and drawn into an
// SVG viewBox of the same size, so the 4K compositions are the identical
// framing rendered at twice the pixel density — no per-resolution tuning.

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;
export const FPS = 30;

/**
 * Reference A runs 10.000s. At 30fps that is exactly 300 frames.
 */
export const SOLAR_DURATION_IN_FRAMES = 300;

/**
 * Reference B runs 6.006s (144 frames at 23.976fps). At 30fps that rounds to
 * 180 frames / 6.000s — 6ms short of the source, which is sub-frame.
 */
export const NEON_DURATION_IN_FRAMES = 180;
