import type { ChromePalette } from "./lib/ChromeText";

/**
 * The three versions differ ONLY in the word, its cap height and the palette.
 * Every other parameter of the piece is shared, so the set reads as one
 * design in three colourways.
 *
 * This is the single source of truth for both: no colour literal and no word
 * string appears anywhere else in the project.
 */
export type VariantName = "welcome" | "thanks" | "subscribe";

export type Variant = {
  /** The word to set. Spaces are rendered with a wider gap than the tracking. */
  word: string;
  /** Cap height as a fraction of frame height. Longer words get less. */
  capHeightRatio: number;
  palette: ChromePalette & {
    background: string;
    /** Pool hues, in draw order. Also the hues the sparks are tinted with. */
    glow: [string, string, string];
    /** The palest spark colour, used for the brightest twinkles. */
    sparkPale: string;
  };
};

export const VARIANTS: Record<VariantName, Variant> = {
  welcome: {
    word: "WELCOME",
    capHeightRatio: 0.16,
    palette: {
      background: "#000000",
      faceLight: "#7FB8FF",
      faceDeep: "#1A2E7A",
      faceCore: "#E8F0FF",
      rimBright: "#C8DCFF",
      rimDark: "#0A1240",
      glow: ["#2E5FE8", "#C43FD4", "#3FC4F5"],
      sparkPale: "#D8E8FF",
    },
  },
  thanks: {
    word: "THANK YOU",
    capHeightRatio: 0.14,
    palette: {
      background: "#000000",
      faceLight: "#FFD98A",
      faceDeep: "#6B3A08",
      faceCore: "#FFF8E0",
      rimBright: "#FFEAB8",
      rimDark: "#3A1C04",
      glow: ["#F5A02E", "#E8563A", "#FFC44F"],
      sparkPale: "#FFE8C8",
    },
  },
  subscribe: {
    word: "SUBSCRIBE",
    capHeightRatio: 0.15,
    palette: {
      background: "#000000",
      faceLight: "#FF8A9F",
      faceDeep: "#6B0A1A",
      faceCore: "#FFF0F4",
      rimBright: "#FFC4D0",
      rimDark: "#3A040C",
      glow: ["#E82040", "#9B3FD4", "#F5603A"],
      sparkPale: "#FFD8E0",
    },
  },
};
