/**
 * Colour. The text is composited in greyscale and tinted at the end, so the
 * whole frame can be recoloured with one gradient multiply.
 */

import { lerp } from "./random";

export type Rgb = [number, number, number];

export type Variant = "colour" | "amber";

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * V1 ramp: red -> magenta -> violet -> blue -> cyan -> teal -> back to red.
 * Cyclic, so sampling it with a wrapped coordinate never shows a seam.
 */
const COLOUR_RAMP: Rgb[] = [
  "#e01030", // red
  "#c11a5c", // carmine
  "#a02a9e", // magenta
  "#8a3ce8", // violet
  "#5a63f0", // indigo
  "#2f9ef2", // azure
  "#22d3ee", // cyan
  "#19b9a8", // teal
  "#8a2f52", // back toward red
].map(hexToRgb);

/** V2 ramp: one warm phosphor hue, no cycling. */
const AMBER_RAMP: Rgb[] = ["#d98a1e", "#f0a028", "#ffd27a", "#f0a028", "#c8781a"].map(hexToRgb);

const sampleRamp = (ramp: Rgb[], u: number): Rgb => {
  const n = ramp.length;
  let t = u - Math.floor(u); // wrap into [0,1)
  t *= n - 1;
  const i = Math.floor(t);
  const f = t - i;
  const a = ramp[i % n];
  const b = ramp[(i + 1) % n];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
};

export const rgbCss = (c: Rgb, alpha = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

/**
 * Tint colour for a given vertical position (0 = top, 1 = bottom) at loop
 * time t (0..1).
 *
 * V1: the ramp is stretched across ~2.4 screen heights and pushed through
 * three whole cycles per loop, so several hues are on screen at once and the
 * cycle closes exactly at the loop point.
 * V2: one hue, static.
 */
export const tintAt = (variant: Variant, v: number, t: number): Rgb => {
  if (variant === "amber") {
    return sampleRamp(AMBER_RAMP, v * 0.5);
  }
  return sampleRamp(COLOUR_RAMP, v * 0.58 + t * 3);
};

/** Near-black background, faintly stained by the dominant hue. */
export const backgroundAt = (variant: Variant, v: number, t: number): Rgb => {
  const c = tintAt(variant, v, t);
  const k = variant === "amber" ? 0.05 : 0.055;
  const floor: Rgb = variant === "amber" ? [7, 5, 3] : [4, 4, 6];
  return [floor[0] + c[0] * k, floor[1] + c[1] * k, floor[2] + c[2] * k];
};
