/**
 * The animation's period, in frames. Every oscillation, sweep pass and hotspot
 * cycle divides this, so frame 0 and frame LOOP_FRAMES are identical and the
 * piece loops seamlessly.
 *
 * It is deliberately separate from a composition's `durationInFrames`: keeping
 * the period a fixed constant means the loop point can be rendered and
 * compared against frame 0 without changing what is being tested.
 */
export const LOOP_FRAMES = 600;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
