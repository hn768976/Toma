import { Easing, interpolate } from "remotion";

/**
 * The one entrance used throughout: fade in while rising, eased out. Nothing
 * bounces — a report page does not overshoot.
 */
export const reveal = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

/** Linear progress, clamped. Used where easing would be wrong (the chart draw). */
export const linearProgress = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
