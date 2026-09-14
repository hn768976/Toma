import { Easing, interpolate, useCurrentFrame } from "remotion";

// Standard reveal ease for anything that enters the frame: fast out of
// the gate, long settle. Used for line draw-ons, bar growth and chips.
export const REVEAL_EASING = Easing.bezier(0.22, 0.9, 0.24, 1);

export const revealAt = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: REVEAL_EASING,
  });

export const useReveal = (start: number, duration: number) =>
  revealAt(useCurrentFrame(), start, duration);

// Continuous, seamless float. Two incommensurate sines so repeats don't
// read as a loop over the short run of these films.
export const drift = (
  frame: number,
  seed: number,
  period: number,
  amount: number,
) => {
  const phase = (seed % 17) * 0.61;
  return (
    (Math.sin((frame / period) * Math.PI * 2 + phase) * 0.65 +
      Math.sin((frame / (period * 0.43)) * Math.PI * 2 + phase * 2.3) * 0.35) *
    amount
  );
};
