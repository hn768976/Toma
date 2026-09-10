/**
 * Every value here is a pure function of the frame and is periodic over the
 * composition's full length, so frame 0 and frame `duration` are identical and
 * the clip loops without a seam. No state, no timers, no randomness that is not
 * seeded by the frame.
 */

export type Motion = {
  /** Yaw of the plate, in degrees. Swings between -MAX_YAW and +MAX_YAW. */
  yaw: number;
  /** Normalised turn, -1..1. The gradient and the parallax ride on this. */
  turn: number;
  /** Scale breath, around 1. */
  breath: number;
  /** Where the specular band sits along the gradient, 0..1. */
  highlight: number;
};

/** Never edge-on: the plate only ever turns this far either way. */
export const MAX_YAW = 20;

/** Peak-to-mean scale breath. */
const BREATH = 0.015;

/** How far the specular band travels along the gradient. */
const HIGHLIGHT_TRAVEL = 0.4;

export const motionAt = (frame: number, duration: number): Motion => {
  const phase = (2 * Math.PI * frame) / duration;
  const turn = Math.sin(phase);

  return {
    turn,
    yaw: MAX_YAW * turn,
    // A quarter-cycle out of step with the turn, so the breath reads as its
    // own thing rather than as an artefact of the rotation.
    breath: 1 + BREATH * Math.cos(phase),
    highlight: 0.5 + HIGHLIGHT_TRAVEL * turn,
  };
};

/**
 * Twinkle for one star. `cycles` is a whole number of cycles per loop, so every
 * star lands back where it started at the loop point however it is staggered.
 */
export const twinkleAt = (
  frame: number,
  duration: number,
  index: number,
): number => {
  const cycles = 1 + (index % 3);
  const offset = ((index * 0.618) % 1) * 2 * Math.PI;
  const phase = (2 * Math.PI * cycles * frame) / duration + offset;
  return 0.68 + 0.32 * Math.sin(phase);
};
