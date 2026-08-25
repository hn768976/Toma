import { BUBBLE_DEEP, BUBBLE_PALE, BUBBLE_SOLID, Z_MAX, Z_MIN } from "./constants";

type Rgb = { r: number; g: number; b: number };

const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const PALE = hexToRgb(BUBBLE_PALE);
const SOLID = hexToRgb(BUBBLE_SOLID);
const DEEP = hexToRgb(BUBBLE_DEEP);

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export const rgbToCss = ({ r, g, b }: Rgb, alpha = 1) =>
  alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;

// Distant bubbles read pale, near ones deep. The mid stop sits at the focal
// depth so the crisp band lands on the signature blue.
export const bubbleColorForDepth = (z: number): string => {
  const t = (z - Z_MIN) / (Z_MAX - Z_MIN);
  const rgb = t < 0.5 ? mix(PALE, SOLID, t / 0.5) : mix(SOLID, DEEP, (t - 0.5) / 0.5);
  return rgbToCss(rgb);
};
