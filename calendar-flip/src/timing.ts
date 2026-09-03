import {Easing} from "remotion";

/** Frame-derived timing. Nothing here carries state between frames. */

export const MONTHS_PER_YEAR = 12;
export const FRAMES_PER_MONTH = 30;
/** Frames the page sits still before it starts to peel. */
export const HOLD_FRAMES = 18;
export const DURATION = MONTHS_PER_YEAR * FRAMES_PER_MONTH;

/**
 * The page leaves rather than lands, so this eases in and then holds its speed
 * out — the last frames are among the fastest, which is the release-and-drop
 * the reference sells, and it arrives ~90% peeled so the step into the next
 * hold is no bigger than an ordinary frame of motion.
 *
 * Layering a fast tail on top of a literal easeInOutCubic was tried first and
 * rejected: cubic is already ~99% done by 83% of the way through, so the blend
 * stalled in the middle and read as a hitch.
 */
const flipCurve = Easing.bezier(0.35, 0, 0.6, 0.5);

export const flipEase = (x: number) => flipCurve(Math.min(1, Math.max(0, x)));

export type Beat = {
  /** Month showing on top, 0-11. */
  monthIndex: number;
  /** 0 while held; rises through the flip to reveal `monthIndex + 1`. */
  flipProgress: number;
  /** Frames since this month landed. */
  sinceLanding: number;
};

export const beatAt = (frame: number): Beat => {
  const wrapped = ((frame % DURATION) + DURATION) % DURATION;
  const monthIndex = Math.floor(wrapped / FRAMES_PER_MONTH);
  const local = wrapped % FRAMES_PER_MONTH;

  if (local < HOLD_FRAMES) {
    return {monthIndex, flipProgress: 0, sinceLanding: local};
  }

  // The flip spans the gap between this month's last hold frame and the next
  // month's first, so neither endpoint is ever rendered twice.
  const span = FRAMES_PER_MONTH - HOLD_FRAMES + 1;
  return {
    monthIndex,
    flipProgress: flipEase((local - HOLD_FRAMES + 1) / span),
    sinceLanding: local,
  };
};
