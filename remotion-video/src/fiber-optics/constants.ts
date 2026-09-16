// Timing and sizing for the "Fiber Optics" 3D piece.
//
// The reference clip is 898x506 @ 30fps, 10.01s long. We keep the frame rate
// and length identical and deliver in standard 16:9 instead of the reference's
// odd 449:253 pixel box.

export const FPS = 30;

/** 300 frames / 30fps = 10.00s, matching the reference. */
export const DURATION_IN_FRAMES = 300;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;
