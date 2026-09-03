/**
 * Colour helpers that take palette hex strings as input, so that a palette can
 * live in exactly one place and every derived tint, shade and alpha is
 * computed rather than hardcoded.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([0-9a-f]{6})$/i;

/** Parses `#rrggbb` (with or without the hash) into 0-255 channels. */
export const parseHex = (hex: string): Rgb => {
  const match = HEX.exec(hex.trim());
  if (!match) throw new Error(`Expected a #rrggbb colour, received "${hex}"`);
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
};

/** `#rrggbb` -> `rgba(r, g, b, alpha)`. */
export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear blend between two hex colours; `t = 0` is `a`, `t = 1` is `b`. */
export const mix = (a: string, b: string, t: number): Rgb => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(ca.r + (cb.r - ca.r) * k),
    g: Math.round(ca.g + (cb.g - ca.g) * k),
    b: Math.round(ca.b + (cb.b - ca.b) * k),
  };
};

/** Blend of two hex colours as a canvas-ready `rgba()` string. */
export const mixRgba = (
  a: string,
  b: string,
  t: number,
  alpha = 1,
): string => {
  const { r, g, b: blue } = mix(a, b, t);
  return `rgba(${r}, ${g}, ${blue}, ${alpha})`;
};

/**
 * Builds a lookup table of `steps` colours blending `from` -> `to`. Canvas
 * fillStyle assignment parses its string every time, so precomputing a small
 * ramp and bucketing into it is far cheaper than composing a colour string per
 * drawn element.
 */
export const colorRamp = (
  from: string,
  to: string,
  steps: number,
): string[] => {
  const ramp: string[] = [];
  for (let i = 0; i < steps; i++) {
    const { r, g, b } = mix(from, to, steps === 1 ? 0 : i / (steps - 1));
    ramp.push(`rgb(${r}, ${g}, ${b})`);
  }
  return ramp;
};
