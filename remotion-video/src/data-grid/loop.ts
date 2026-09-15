import { DURATION_IN_FRAMES } from "./constants";

/**
 * A sine that completes a whole number of periods over the clip, so the
 * value on the last frame hands back to the first one. Every oscillation
 * in the field goes through this — that is what keeps the export
 * loopable end to end.
 */
export const loopSin = (frame: number, periods: number, phase = 0) =>
  Math.sin((frame / DURATION_IN_FRAMES) * Math.PI * 2 * periods + phase);
