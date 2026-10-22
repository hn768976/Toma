// The reference clip is 600 frames long (20.02 s at 29.97 fps). At 30 fps we
// keep the same 600 frames so every reference frame maps 1:1 onto ours.
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

// The composition is authored at 4K UHD; 1080p deliveries are rendered from
// it with `--scale=0.5`.
export const WIDTH = 3840;
export const HEIGHT = 2160;
