// Timing and resolution for the "cell division" motion graphic.
//
// The reference clip is 768x432 @ 29.97fps, 11.04s long. We deliver at a
// clean 30fps, so 331 frames (11.033s) is the closest whole-frame match --
// within half a frame of the reference.

export const FPS = 30;
export const DURATION_IN_FRAMES = 331;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** Seconds of screen time. Everything in colony.ts is timed against this. */
export const DURATION_IN_SECONDS = DURATION_IN_FRAMES / FPS;
