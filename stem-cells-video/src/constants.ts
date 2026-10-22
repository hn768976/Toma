// Composition is authored in 4K; the final MP4 is rendered at 1080p with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// Reference clip: 226 frames @ 25 fps = 9.04 s. At 30 fps the closest whole
// frame count is 271 (9.033 s) — within 1/150 s of the reference.
export const REFERENCE_SECONDS = 9.04;
export const DURATION_IN_FRAMES = Math.round(REFERENCE_SECONDS * FPS);

// All cell layout data is measured in this coordinate space (the reference
// frame upscaled 2x), origin top-left, y down. The orthographic camera maps it
// 1:1 onto the composition so positions match the reference exactly.
export const SPACE_W = 1192;
export const SPACE_H = 672;
