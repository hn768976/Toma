import { clamp, lerp } from "./random";

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const rgbToCss = ({ r, g, b }: Rgb, alpha = 1) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = clamp(t, 0, 1);
  return { r: lerp(a.r, b.r, k), g: lerp(a.g, b.g, k), b: lerp(a.b, b.b, k) };
};

/**
 * Mix two hex colours and return a canvas-ready rgba() string.
 *
 * Note that the result is NOT a hex string, so it cannot be fed back into
 * mixHex or withAlpha — a mistake that yields `rgba(NaN, ...)` and a
 * DOMException from addColorStop. Pass the alpha here instead of wrapping.
 */
export const mixHex = (a: string, b: string, t: number, alpha = 1) =>
  rgbToCss(mixRgb(hexToRgb(a), hexToRgb(b), t), alpha);

/** A hex colour with an alpha applied, as a canvas-ready rgba() string. */
export const withAlpha = (hex: string, alpha: number) =>
  rgbToCss(hexToRgb(hex), alpha);

/** Samples a list of hex stops evenly across t = 0..1. */
export const rampAt = (stops: readonly string[], t: number): string => {
  if (stops.length === 0) return "rgba(0, 0, 0, 1)";
  if (stops.length === 1) return stops[0];
  const k = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(k), stops.length - 2);
  return mixHex(stops[i], stops[i + 1], k - i);
};
