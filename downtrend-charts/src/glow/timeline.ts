import { clamp01, easeInOutSine, easeOutCubic, interpolateKeys } from "../common/math";

export const BAR_COUNT = 7;
/** Bar heights in world units (left to right). */
export const BAR_HEIGHTS = [5.0, 4.5, 3.8, 2.95, 2.1, 1.4, 0.82];
export const BAR_SPACING = 1.22;
export const BAR_WIDTH = 0.64;
export const BAR_DEPTH = 0.64;
export const barX = (i: number) => -3.66 + i * BAR_SPACING;

/** Seconds at which each bar starts growing (measured from the reference). */
export const BAR_START = [0.45, 1.65, 2.9, 3.92, 4.92, 5.92, 6.92];
/** Growth duration per bar (bar 1 rises slowly on its own at the start). */
export const BAR_GROW = [1.85, 1.35, 1.3, 1.3, 1.3, 1.3, 1.3];

/** 0..1 growth of bar i at time t (seconds). */
export const barProgress = (i: number, t: number) => {
  const p = clamp01((t - BAR_START[i]) / BAR_GROW[i]);
  return easeInOutSine(p);
};

/** Arrow: tail fixed above bars 1/2, head travels right as new bars grow. */
export const ARROW_TAIL: [number, number] = [barX(1) - 0.15, 5.3];
export const ARROW_END: [number, number] = [barX(6) + 0.35, 2.55];
/** Arrow pops out quickly when bar 2 appears, then creeps on with the chart. */
export const arrowReach = (t: number) =>
  interpolateKeys(
    t,
    [1.5, 1.95, 2.35, 4.5, 7.0, 9.6],
    [0, 0.4, 0.52, 0.8, 0.95, 1],
    easeOutCubic,
  );

/**
 * Base glow of bar i: fades in from just before the bar starts (a faint
 * light pad on the floor, as in the reference) so nothing pops on.
 */
export const glowAmount = (i: number, t: number) =>
  easeInOutSine(clamp01((t - BAR_START[i] + 0.35) / 0.75));
