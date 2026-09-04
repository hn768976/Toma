import { Easing, interpolate } from "remotion";

/**
 * Build-sequence helper: 0 before `start`, 1 after `end`, smooth in between.
 * Everything in the scene enters through one of these — never a raw fade.
 */
export const phase = (
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = Easing.inOut(Easing.cubic),
) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Staggered variant: element `i` of `n` runs inside [start, end]. */
export const stagger = (
  frame: number,
  i: number,
  n: number,
  start: number,
  end: number,
  each: number,
) => {
  const span = Math.max(1, end - start - each);
  const s = start + (n <= 1 ? 0 : (i / (n - 1)) * span);
  return phase(frame, s, s + each);
};
