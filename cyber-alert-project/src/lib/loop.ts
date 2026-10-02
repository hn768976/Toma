import { useCurrentFrame, useVideoConfig } from "remotion";

import { LOOP } from "./loop-constants";

export { FPS, LOOP } from "./loop-constants";

const TAU = Math.PI * 2;

/** Frame wrapped into the loop, so frame 600 renders exactly like frame 0. */
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;

/** Loop phase in [0, 1). */
export const phase = (frame: number) => loopFrame(frame) / LOOP;

/** Sine with a whole number of cycles per loop. */
export const osc = (frame: number, cycles: number, offset = 0) => {
  if (!Number.isInteger(cycles)) throw new Error(`osc cycles must be an integer, got ${cycles}`);
  return Math.sin(TAU * (cycles * phase(frame) + offset));
};

/** Sawtooth in [0,1) with a whole number of cycles per loop. */
export const saw = (frame: number, cycles: number, offset = 0) => {
  if (!Number.isInteger(cycles)) throw new Error(`saw cycles must be an integer, got ${cycles}`);
  const v = cycles * phase(frame) + offset;
  return v - Math.floor(v);
};

/**
 * Frame-size units. Everything is authored in 1080p pixels and multiplied by
 * u, so a 1px line at 1080p is 2px at 4K and keeps its share of the frame.
 */
export const useUnits = () => {
  const { width, height } = useVideoConfig();
  return { u: width / 1920, width, height };
};

export const useLoopFrame = () => loopFrame(useCurrentFrame());

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export const easeOutBack = (v: number, s = 2.2) => {
  const x = clamp01(v) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
