export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

export const rgba = (c: Rgb, alpha: number) =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha.toFixed(4)})`;

/**
 * Maps `t` in [0, 1] across a ramp of tones, interpolating between the two it
 * falls between. Used to shift far elements toward the palette's dimmest tone
 * and near ones toward its brightest.
 */
export const sampleRamp = (ramp: readonly Rgb[], t: number): Rgb => {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(scaled));
  return mixRgb(ramp[index], ramp[index + 1], scaled - index);
};
