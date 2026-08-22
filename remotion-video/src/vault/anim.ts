// Element-level motion. Completely independent of camera.ts — nothing here
// reads camera state, and the camera never reads any of this.

import { Easing, interpolate } from "remotion";
import { ENTER_FRAMES, EXIT_FRAMES } from "./constants";

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN_OUT = Easing.bezier(0.4, 0, 0.2, 1);

export type Reveal = { opacity: number; scale: number; rendered: boolean };

const HIDDEN: Reveal = { opacity: 0, scale: 0.85, rendered: false };

/**
 * Elements enter by scaling 0.85 → 1.0 with a fade (0.4s, ease-out) and exit
 * by scaling 1.0 → 0.9 with a fade (0.3s). Nothing ever slides in from
 * off-screen, and there are no hard cuts.
 */
export const reveal = (frame: number, start: number, end?: number): Reveal => {
  if (frame < start) return HIDDEN;

  if (end !== undefined && frame >= end) {
    return { opacity: 0, scale: 0.9, rendered: false };
  }

  const enter = interpolate(frame - start, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  let exit = 1;
  if (end !== undefined) {
    exit = interpolate(frame, [end - EXIT_FRAMES, end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_IN_OUT,
    });
  }

  return {
    opacity: enter * exit,
    scale: 0.85 + 0.15 * enter - 0.1 * (1 - exit),
    rendered: true,
  };
};

/**
 * The slow idle float every on-screen element carries: a sine on translateY,
 * ±6px, 3-4s period. `seed` desynchronises elements so nothing bobs in
 * lockstep.
 */
export const floatY = (
  frame: number,
  fps: number,
  seed: number,
  amplitude = 6,
) => {
  const period = 3 + (seed % 5) * 0.25; // 3.00s – 4.00s
  const phase = (seed * 0.618033) % 1;
  return Math.sin(((frame / fps / period) + phase) * Math.PI * 2) * amplitude;
};

/** interpolate() with the house easing and both ends clamped. */
export const ease = (
  frame: number,
  input: readonly number[],
  output: readonly number[],
) =>
  interpolate(frame, input as number[], output as number[], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_IN_OUT,
  });

/** Same, but ease-out — for things that arrive and settle. */
export const easeOut = (
  frame: number,
  input: readonly number[],
  output: readonly number[],
) =>
  interpolate(frame, input as number[], output as number[], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
