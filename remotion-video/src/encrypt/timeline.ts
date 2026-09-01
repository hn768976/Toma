/** Frame boundaries. 580 frames @ 30fps. One-shot: opens black, ends black. */
export const TIMELINE = {
  /** Black hold. */
  blackOut: 30,
  /** Backdrop fades up, side panels draw on staggered. */
  backdropIn: 70,
  /** Dialog springs in from 0.96, border first then contents. */
  dialogIn: 100,
  /** Progress phase runs to here. */
  progressEnd: 380,
  /** Transition (flash / glitch) ends. */
  transitionEnd: 410,
  /** Outcome state holds to here. */
  outcomeEnd: 520,
  /** Fade to black completes. */
  end: 580,
} as const;

export const DURATION_IN_FRAMES = 580;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
