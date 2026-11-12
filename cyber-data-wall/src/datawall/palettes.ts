/**
 * Colour palettes for the Cyber Data Wall.
 * All values are sRGB hex; they are converted to linear space in the scene.
 */
export type WallPalette = {
  name: string;
  background: string;
  fog: string;
  wall: string;
  dotDim: string;
  dotBright: string;
  panelFace: string;
  panelSide: string;
  panelLine: string;
  lightBlock: string;
  laser: string;
  particle: string;
  vignette: string;
};

/** V1 – cold, desaturated steel-blue monochrome (matches the reference). */
export const STEEL_BLUE: WallPalette = {
  name: "Steel Blue",
  background: "#020307",
  fog: "#03050a",
  wall: "#030409",
  dotDim: "#3b4b66",
  dotBright: "#d9e6ff",
  panelFace: "#06090f",
  panelSide: "#1a2333",
  panelLine: "#e3edff",
  lightBlock: "#cfdcf5",
  laser: "#b8c8e6",
  particle: "#c6d6f2",
  vignette: "#000000",
};

/** V2 – warm amber / molten-gold data centre with teal laser accents. */
export const AMBER_TEAL: WallPalette = {
  name: "Amber Core",
  background: "#060302",
  fog: "#0a0503",
  wall: "#0b0604",
  dotDim: "#7a3d12",
  dotBright: "#ffd59a",
  panelFace: "#0d0704",
  panelSide: "#3a1d0c",
  panelLine: "#ffcf8a",
  lightBlock: "#ffb766",
  laser: "#46e6d8",
  particle: "#7ff2e6",
  vignette: "#000000",
};
