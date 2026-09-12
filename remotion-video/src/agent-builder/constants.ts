// Shared sizing/timing for the "AI Agent Builder" UI motion graphic.
//
// Everything is authored against a 1920x1080 design grid. The compositions
// scale that grid with a single CSS transform (see `Stage`), so the same
// source renders pixel-sharp at 1080p and at 4K without duplicated layout
// code or hand-tuned font sizes.

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const UHD_WIDTH = BASE_WIDTH * 2; // 3840
export const UHD_HEIGHT = BASE_HEIGHT * 2; // 2160

// 15.0s -- matches the reference clip exactly (450 frames at 30fps).
export const DURATION_IN_FRAMES = 450;
