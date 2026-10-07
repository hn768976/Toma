// "One data row per version": the Light Streaks scene is identical; only this
// row changes. To add a colourway, add a row here and a <Composition> in Root.tsx.
export interface StreaksPalette {
  id: string;
  /** Streak colours (sRGB hex) with relative weights. */
  streaks: Array<{ hex: string; weight: number }>;
  flareCore: string;
  flareGlow: string;
  skyTop: string;
  skyHorizon: string;
  /** Violet/amber haze that rises from the flare. */
  haze: string;
  glint: string;
}

export const BLUE_MAGENTA: StreaksPalette = {
  id: "BlueMagenta",
  streaks: [
    { hex: "#2A6AFF", weight: 0.5 }, // blue
    { hex: "#3AD8FF", weight: 0.28 }, // cyan
    { hex: "#FF2AC8", weight: 0.09 }, // magenta
    { hex: "#8A4AFF", weight: 0.13 }, // violet
  ],
  flareCore: "#FFFFFF",
  flareGlow: "#A83AFF",
  skyTop: "#05031A",
  skyHorizon: "#2A0A5A",
  haze: "#8A1EE0",
  glint: "#B07AFF",
};

export const GOLD: StreaksPalette = {
  id: "Gold",
  streaks: [
    { hex: "#FFB02A", weight: 0.38 }, // amber
    { hex: "#FF7A1A", weight: 0.27 }, // orange
    { hex: "#FFE8A0", weight: 0.25 }, // white-gold
    { hex: "#FF5A6A", weight: 0.1 }, // rose
  ],
  flareCore: "#FFF2C8",
  flareGlow: "#FF9A2A",
  skyTop: "#0A0502",
  skyHorizon: "#4A2208",
  haze: "#C86A12",
  glint: "#FFC87A",
};
