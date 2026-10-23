// All compositions are authored at 4K UHD and delivered at 1080p via --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// Reference clips are 29.97 fps. Durations below are the nearest whole number
// of frames at exactly 30 fps:
//   Composition 1 reference: 20.020 s -> 601 frames = 20.033 s (|Δ| = 13 ms)
//   Composition 2 reference: 19.953 s -> 599 frames = 19.967 s (|Δ| = 13 ms)
export const SCORE_DOLLY_FRAMES = 601;
export const FLOATING_NOTES_FRAMES = 599;
