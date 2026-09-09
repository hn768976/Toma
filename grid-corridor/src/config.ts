export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s

/**
 * How many transverse spacings the corridor advances over the full 450 frames.
 *
 * This is the entire loop mechanism, and it must stay an integer: at frame 450
 * the depth offset has advanced by a whole number of spacings, so the set of
 * projected depths — and therefore the image — is identical to frame 0.
 *
 * 48 spacings x 0.45 world units over 15s is 1.44 units/second, which carries a
 * transverse line from the horizon (z = 6.95) to the frame edge (z = 2) in
 * 3.44s, inside the 3-4s the brief calls for. Slowing the corridor down is a
 * one-line change here; keep the value a whole number.
 */
export const SPACINGS_PER_LOOP = 48;

/** Brightness pulse period in frames. 450 / 150 = 3 whole cycles per loop. */
export const PULSE_PERIOD = 150;
export const PULSE_AMOUNT = 0.08;
