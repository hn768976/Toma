/**
 * The ONLY place in the project where a hex literal may appear.
 *
 * Every palette keeps `candleUp` and `candleDown` in contrasting hues — that
 * distinction is the single piece of information a financial image has to
 * carry, so a palette where the two read alike would be unusable.
 */
export const PALETTES = {
  cyanNavy: {
    bg: "#030A1C",
    candleUp: "#4FD4C4",
    candleDown: "#E8455F",
    curvePrimary: "#2ED4F5",
    curveSecondary: "#F5C43F",
    textDim: "#2E5C8A",
    textBright: "#C8E8FF",
    flareCore: "#FFFFFF",
  },
  tealBlue: {
    bg: "#01121C",
    candleUp: "#5FE8D4",
    candleDown: "#F5606B",
    curvePrimary: "#4FC4E8",
    curveSecondary: "#E8D45F",
    textDim: "#1E5C6B",
    textBright: "#C8F8FF",
    flareCore: "#E8FCFF",
  },
  violetPink: {
    bg: "#0A0620",
    candleUp: "#A85FF5",
    candleDown: "#F5488A",
    curvePrimary: "#C45FE8",
    curveSecondary: "#F5A03F",
    textDim: "#4A2E7A",
    textBright: "#E8D8FF",
    flareCore: "#FFF0F8",
  },
  amberDark: {
    bg: "#140A02",
    candleUp: "#F5B84F",
    candleDown: "#E8563A",
    curvePrimary: "#FFC46A",
    curveSecondary: "#4FC4E8",
    textDim: "#6B4514",
    textBright: "#FFE8C8",
    flareCore: "#FFF8E8",
  },
  greenSlate: {
    bg: "#04140A",
    candleUp: "#4FE87A",
    candleDown: "#F5606B",
    curvePrimary: "#3FD46A",
    curveSecondary: "#F5C43F",
    textDim: "#1A5C30",
    textBright: "#D8FFE4",
    flareCore: "#F0FFF4",
  },
  magentaBlue: {
    bg: "#10021A",
    candleUp: "#E85FD4",
    candleDown: "#4F9FE8",
    curvePrimary: "#F55FC4",
    curveSecondary: "#5FD4F5",
    textDim: "#5C1A5C",
    textBright: "#FFD8F5",
    flareCore: "#FFF0FC",
  },
} as const;

export type PaletteName = keyof typeof PALETTES;
export type Palette = (typeof PALETTES)[PaletteName];
export type ColorKey = keyof Palette;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export const isPaletteName = (v: string): v is PaletteName =>
  Object.prototype.hasOwnProperty.call(PALETTES, v);
