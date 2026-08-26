// Every colour used by the particle-rain composition lives here. Nothing
// else in this folder may contain a hex literal — swapping the palette (or
// adding a whole new one for a future variant) is a change to this file
// only.

export const THEME_NAMES = ["cyan"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export type Theme = {
  /** Near-black navy the frame sits on. */
  backgroundDeep: string;
  /** Lifted navy pooled around the source glow. */
  backgroundMid: string;
  /** The hot accent the brightest grains burn to. */
  dotBright: string;
  /** Mid-tone body of the streams. */
  dotMid: string;
  /** The far, barely-there grains. */
  dotDim: string;
  /** The rare brightest grains, and the colour a flare flashes to. */
  dotWhite: string;
  /** The off-screen light the streams appear to fall away from. */
  sourceGlow: string;
};

export const THEMES: Record<ThemeName, Theme> = {
  cyan: {
    backgroundDeep: "#030B1F",
    backgroundMid: "#0A1F42",
    dotBright: "#4FF5E8",
    dotMid: "#2E9FD4",
    dotDim: "#1A4A7A",
    dotWhite: "#E8FDFF",
    sourceGlow: "#5FD8F5",
  },
};

// The four dot tones, ordered dim -> white. A dot stores an index into this
// array, so the draw loop never touches colour strings per frame.
export const DOT_TONES = ["dotDim", "dotMid", "dotBright", "dotWhite"] as const;

export type DotTone = (typeof DOT_TONES)[number];

/** Index into DOT_TONES of the tone a flare flashes to. */
export const FLARE_TONE_INDEX = DOT_TONES.indexOf("dotWhite");

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
};

export const rgba = ({ r, g, b }: Rgb, alpha: number): string =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Multiplies a colour toward black — used to derive the vignette tint from
 *  the background rather than inventing another palette entry. */
export const shade = ({ r, g, b }: Rgb, amount: number): Rgb => ({
  r: Math.round(r * amount),
  g: Math.round(g * amount),
  b: Math.round(b * amount),
});
