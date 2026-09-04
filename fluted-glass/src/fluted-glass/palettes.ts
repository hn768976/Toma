export type BloomTone = "hot" | "mid" | "dim";

export type Palette = {
  /** Colour of the unlit field behind the ribs. */
  base: string;
  /** Near-white core of the two bright blooms. */
  hot: string;
  /** Mid-brightness blooms. */
  mid: string;
  /** Dim, tinted blooms that only ever read as a wash. */
  dim: string;
};

export const PALETTES: Record<string, Palette> = {
  // V1 - cool blue/steel, the reference match.
  blue: { base: "#050a14", hot: "#eef4ff", mid: "#a8c8ea", dim: "#4a7fc4" },
  // V2 - warm champagne/gold, reads as brushed brass.
  gold: { base: "#100b04", hot: "#fff3dd", mid: "#e8d2a0", dim: "#c49a4a" },
  // V3 - monochrome. Every highlight is exactly neutral (R = G = B) so no
  // hue can survive into the encode.
  mono: { base: "#0a0a0c", hot: "#ffffff", mid: "#d6d6d6", dim: "#8a8a8a" },
};

export const toneColor = (palette: Palette, tone: BloomTone) =>
  tone === "hot" ? palette.hot : tone === "mid" ? palette.mid : palette.dim;

export const hexToRgb = (hex: string) => {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

export const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
