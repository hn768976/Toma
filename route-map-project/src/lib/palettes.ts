import type { Palette, PinColor, RouteColor } from "./types";

export interface PaletteSpec {
  /** Frame backdrop behind the map plane. */
  backdrop: string;
  grid: string;
  gridOpacity: number;
  gridMajorOpacity: number;
  readout: string;
  route: Record<RouteColor, string>;
  marker: string;
  /** Multiplied over the baked basemap; keeps the two grades in one place. */
  baseFilter: string;
  vignette: string;
}

export const PALETTES: Record<Palette, PaletteSpec> = {
  warm: {
    backdrop: "#03080f",
    grid: "#7ad4e8",
    gridOpacity: 0.2,
    gridMajorOpacity: 0.32,
    readout: "#9fd8e8",
    route: { cyan: "#22d3ee", white: "#eef6fb", green: "#8ae0a0" },
    marker: "#ffffff",
    baseFilter: "saturate(1.06) contrast(1.03) brightness(1.02)",
    vignette: "rgba(2,7,13,0.55)",
  },
  cool: {
    backdrop: "#040c18",
    grid: "#a8d8f0",
    gridOpacity: 0.2,
    gridMajorOpacity: 0.3,
    readout: "#a8d8f0",
    route: { cyan: "#7fe3f5", white: "#f2f8fc", green: "#a9e6c0" },
    marker: "#ffffff",
    baseFilter: "saturate(1.0) contrast(1.04) brightness(1.0)",
    vignette: "rgba(3,10,22,0.58)",
  },
};

export const PIN_COLORS: Record<PinColor, { top: string; body: string; rim: string }> = {
  red: { top: "#ff6a5e", body: "#e0342a", rim: "#8e1810" },
  yellow: { top: "#ffd469", body: "#f0b020", rim: "#96690c" },
  blue: { top: "#7ab0f5", body: "#2a7ae0", rim: "#14458c" },
  green: { top: "#71dfa0", body: "#2ec06a", rim: "#137540" },
  orange: { top: "#ffb066", body: "#f08420", rim: "#94490a" },
};
