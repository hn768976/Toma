/**
 * Fixed across every composition.
 *
 * `LOOP_FRAMES` is the period the motion closes over, kept separate from the
 * composition's `durationInFrames` so the loop-closure check can render 301
 * frames without changing what "one loop" means. Frame 300 of a 301-frame
 * render must be pixel-identical to frame 0 — comparing frame 0 to frame 299
 * shows a one-step difference and is not a failure.
 */
export const LOOP_FRAMES = 300;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
