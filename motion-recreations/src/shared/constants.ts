// All compositions are authored at 4K UHD and delivered at 1080p via `--scale=0.5`.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// Both reference clips run 20.02 s (600 frames @ 29.97 fps).
// At exactly 30 fps that is 600.6 frames; 601 frames (20.033 s) is the
// closest whole-frame duration (+13 ms vs. 600 frames' -20 ms).
export const DURATION_IN_FRAMES = 601;
