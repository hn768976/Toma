export const FPS = 30;

/**
 * The reference clip is 151 frames at 30fps (5.0333s). Frame 150 repeats
 * frame 0, so the motion loops over 150 frames and the composition carries the
 * extra frame to match the reference length exactly.
 */
export const LOOP_FRAMES = 150;
export const DURATION_IN_FRAMES = 151;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;
