import { Easing, interpolate } from "remotion";
import { hash } from "./random";

type Beat = readonly [number, number];

/**
 * Progress 0..1 for one element of a staggered layer. `order` places the
 * element inside the beat; every element takes `itemDuration` frames to
 * arrive, and the last one finishes exactly on the beat's final frame.
 */
export const stagger = (
  frame: number,
  order: number,
  count: number,
  beat: Beat,
  itemDuration: number,
  easing: (t: number) => number = Easing.out(Easing.cubic),
) => {
  const [start, end] = beat;
  const span = Math.max(0, end - start - itemDuration);
  const from = start + (count <= 1 ? 0 : (order / (count - 1)) * span);
  return interpolate(frame, [from, from + itemDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
};

/** Degrees of rotation accumulated since the layer's beat began. */
export const spin = (frame: number, startFrame: number, ratePerFrame: number) =>
  Math.max(0, frame - startFrame) * ratePerFrame;

/**
 * Sparse per-element dropout. Held for two frames at a time so it reads as a
 * flicker rather than per-frame noise.
 */
export const flicker = (frame: number, id: number, depth = 0.45) => {
  const n = hash(id, Math.floor(frame / 2));
  if (n > 0.978) return 1 - depth;
  if (n > 0.958) return 1 - depth * 0.4;
  return 1;
};

/** Draw-on props for any stroked path that carries `pathLength={1}`. */
export const drawOn = (progress: number) => ({
  pathLength: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1 - progress,
});
