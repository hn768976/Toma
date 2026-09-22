/**
 * The loop period is a design constant, not `durationInFrames`.
 *
 * Two reasons. First, it makes the loop-closure check meaningful: extending a
 * composition to 601 frames to compare frame 0 against frame 600 only proves
 * anything if the periodic maths keeps using 600 as its period. Second, it
 * means a composition can be trimmed or extended without silently changing
 * the phase of every animated quantity in it.
 */
export const LOOP_FRAMES = 600;

/** Look 1 draws once and holds. It is deliberately NOT a loop. */
export const ONESHOT_FRAMES = 300;
