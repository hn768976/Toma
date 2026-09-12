/**
 * One design space for both films: everything is authored against a
 * 1920x1080 canvas and scaled up by <Scaled> for the 4K compositions, so a
 * single set of coordinates drives every output resolution.
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
export const FPS = 30;

export const DISPLAY_FONT = '"Space Grotesk", system-ui, sans-serif';
export const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

/** Accent ramp shared by both films. */
export const ACCENT = {
  teal: "#2dd4bf",
  cyan: "#22d3ee",
  green: "#34d399",
  emerald: "#22c55e",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  magenta: "#d946ef",
  pink: "#ec4899",
  amber: "#f0a020",
  white: "#e8eef5",
} as const;

export type AccentName = keyof typeof ACCENT;

/** Near-black command-centre palette used by the Operations Matrix film. */
export const MATRIX = {
  bg: "#03060c",
  bgGlowInner: "#0b1a2e",
  panel: "rgba(9, 18, 32, 0.72)",
  panelInner: "rgba(7, 14, 26, 0.66)",
  border: "rgba(56, 96, 140, 0.28)",
  borderSoft: "rgba(56, 96, 140, 0.16)",
  grid: "rgba(70, 120, 170, 0.10)",
  text: "#dce8f5",
  textDim: "#6f88a4",
  textFaint: "#41556c",
} as const;

/** Slightly lifted navy used by the Processing Pipeline film. */
export const PIPE = {
  bg: "#0b1120",
  bgGlow: "#131d33",
  card: "rgba(20, 31, 53, 0.78)",
  border: "rgba(88, 120, 168, 0.30)",
  text: "#e6edf7",
  textDim: "#8296b4",
  textFaint: "#4f6180",
  track: "rgba(120, 145, 185, 0.20)",
} as const;

/** Translucent tint of an accent, for fills and glows. */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
