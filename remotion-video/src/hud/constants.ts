// Timing and design-space constants shared by both HUD compositions.
//
// Every component lays itself out in a fixed 1920x1080 "design space" and
// is drawn into an <svg viewBox="0 0 1920 1080"> whose pixel width/height
// is the real output size. That means the 4K compositions re-rasterise
// every vector and glyph at native resolution instead of upscaling a
// 1080p raster, so the two resolutions stay pixel-identical in layout and
// fully crisp in detail.

export const FPS = 30;

// 20.00s -- matched to the reference clip (600 frames at 30fps).
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Rotation/cycle speeds are expressed in whole turns per LOOP so that the
// last frame lines up with frame 0 and the clip can be looped seamlessly.
export const LOOP = DURATION_IN_FRAMES;
