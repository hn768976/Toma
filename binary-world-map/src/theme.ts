/**
 * Every colour in the piece lives here. No component contains a hex literal:
 * layers receive resolved strings from this object, which is what makes the
 * `variant` prop a single point of change.
 */
export type Variant = "blue" | "amber" | "jade";

export type Theme = {
  background: string;
  /** The majority of the digits. */
  landDigitDim: string;
  landDigitMid: string;
  /** A scattered minority. */
  landDigitBright: string;
  /** Soft bloom behind the continents. */
  landGlow: string;
  /** The straight sightlines. Near-white, thin. */
  connectLine: string;
  nodeWhite: string;
  nodeHalo: string;
  /** The curved background lines. */
  contourGrey: string;
  /** Callout label type. */
  textPale: string;
  starPale: string;
};

export const THEME: Record<Variant, Theme> = {
  blue: {
    background: "#000000",
    landDigitDim: "#1A5C9F",
    landDigitMid: "#3F9FE8",
    landDigitBright: "#7FD4FF",
    landGlow: "#2E6FC4",
    connectLine: "#C8D8E8",
    nodeWhite: "#FFFFFF",
    nodeHalo: "#A8D4F5",
    contourGrey: "#4A5560",
    textPale: "#8AA8C4",
    starPale: "#6A7A8A",
  },
  amber: {
    background: "#000000",
    landDigitDim: "#8A4E12",
    landDigitMid: "#D9871F",
    landDigitBright: "#FFCE7A",
    landGlow: "#B26A18",
    connectLine: "#E8DCC8",
    nodeWhite: "#FFFFFF",
    nodeHalo: "#F5D9A8",
    contourGrey: "#5F5648",
    textPale: "#C4AE8A",
    starPale: "#8A7E6A",
  },
  jade: {
    background: "#000000",
    landDigitDim: "#12684F",
    landDigitMid: "#28B489",
    landDigitBright: "#84F0CD",
    landGlow: "#1C8264",
    connectLine: "#CCE8DE",
    nodeWhite: "#FFFFFF",
    nodeHalo: "#A8F5D8",
    contourGrey: "#48605A",
    textPale: "#8AC4B0",
    starPale: "#6A8A80",
  },
};

export const getTheme = (variant: Variant | undefined): Theme =>
  THEME[variant ?? "blue"] ?? THEME.blue;
