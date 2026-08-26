/**
 * Every colour used anywhere in this project lives here. Nothing else in the
 * codebase is allowed to contain a colour literal.
 */
export const THEMES = {
  /** Deep navy, effectively black once the vignette lands on the corners. */
  backgroundDeep: '#050E2E',
  /** The soft lighter wash that sits behind the map. */
  backgroundGlow: '#16306B',
  /** A cooler, more teal-leaning blue, used by the tilted variant. */
  backgroundDeepCool: '#041A2E',
  backgroundGlowCool: '#14567E',
  /** Land dots at full brightness. */
  dotPale: '#C8D8F0',
  /** Land dots that have drifted out toward the frame edges. */
  dotDim: '#6A82B0',
  arcCyan: '#3FD8F5',
  arcRed: '#E8455F',
  arcViolet: '#8B6FE8',
  arcTeal: '#3FF5B0',
  arcAmber: '#F5A93F',
  arcMagenta: '#F55FD0',
  /** Endpoint pulses and travelling dots. */
  nodeWhite: '#F0F8FF',
  /** Pure black, used only by the vignette. */
  shadow: '#000000',
  /** Neutral mid grey, used only as the grain's zero point. */
  grainNeutral: '#808080',
} as const;

export type ThemeColor = keyof typeof THEMES;

/**
 * The arc colours. Every arc takes a different one, so this list also sets the
 * hard ceiling on how many arcs a variant may declare.
 */
export const ARC_PALETTE = [
  THEMES.arcCyan,
  THEMES.arcRed,
  THEMES.arcViolet,
  THEMES.arcTeal,
  THEMES.arcAmber,
  THEMES.arcMagenta,
] as const;

export type Rgb = {r: number; g: number; b: number};

export const toRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

export const rgba = (hex: string, alpha: number): string => {
  const {r, g, b} = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear blend between two theme colours, returned as an rgba() string. */
export const mixRgba = (
  hexA: string,
  hexB: string,
  t: number,
  alpha: number,
): string => {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgba(${lerp(a.r, b.r)}, ${lerp(a.g, b.g)}, ${lerp(a.b, b.b)}, ${alpha})`;
};
