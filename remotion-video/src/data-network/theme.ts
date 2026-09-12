// Two skins of the same board: the blue one mirrors the reference clip, the
// green one is the alternate colourway. Only colours differ — geometry,
// timing and layout are shared, so the two renders cut together.

export type DataNetworkTheme = {
  /** Colour behind everything, seen through the vignette corners. */
  void: string;
  /** Centre and edge of the board's own radial "backlight". */
  boardCore: string;
  boardEdge: string;
  /** Faint grid ruled across the board. */
  grid: string;
  /** Halftone landmass, bright centre to dim rim. */
  landHot: string;
  landCool: string;
  /** Network links and the pulses travelling along them. */
  link: string;
  linkHot: string;
  node: string;
  nodeGlow: string;
  /** HUD chrome. */
  panelFill: string;
  panelStroke: string;
  micro: string;
  text: string;
  textDim: string;
  /** Accent ramp used by bars, donuts and spectra. */
  accents: readonly string[];
  /** Atmospheric haze sitting over the far half of the board. */
  hazeStrong: string;
  hazeSoft: string;
};

export const BLUE_THEME: DataNetworkTheme = {
  void: "#01040c",
  boardCore: "#1c5cae",
  boardEdge: "#061534",
  grid: "rgba(130, 185, 255, 0.16)",
  landHot: "#e8f4ff",
  landCool: "#57a6f2",
  link: "rgba(150, 205, 255, 0.42)",
  linkHot: "#bfe4ff",
  node: "#ffc24a",
  nodeGlow: "rgba(255, 194, 74, 0.55)",
  panelFill: "rgba(64, 132, 235, 0.14)",
  panelStroke: "rgba(130, 190, 255, 0.34)",
  micro: "rgba(186, 219, 255, 0.62)",
  text: "#e4f1ff",
  textDim: "rgba(198, 224, 255, 0.55)",
  accents: [
    "#ff2f9c",
    "#c744ff",
    "#3ad9ff",
    "#2fe8a8",
    "#ffd23f",
    "#ff7a3d",
    "#7c8cff",
    "#f5f8ff",
  ],
  hazeStrong: "rgba(8, 26, 66, 0.86)",
  hazeSoft: "rgba(8, 26, 66, 0.4)",
};

export const GREEN_THEME: DataNetworkTheme = {
  void: "#000a06",
  boardCore: "#13905e",
  boardEdge: "#04231a",
  grid: "rgba(130, 255, 205, 0.16)",
  landHot: "#eaffef",
  landCool: "#39dd96",
  link: "rgba(150, 255, 205, 0.42)",
  linkHot: "#c8ffe4",
  node: "#e9ff3c",
  nodeGlow: "rgba(233, 255, 60, 0.5)",
  panelFill: "rgba(38, 190, 124, 0.14)",
  panelStroke: "rgba(120, 255, 196, 0.32)",
  micro: "rgba(180, 255, 218, 0.62)",
  text: "#e2fff0",
  textDim: "rgba(190, 255, 224, 0.55)",
  accents: [
    "#00ffa1",
    "#7dff2e",
    "#00e6c4",
    "#c4ff36",
    "#31d98a",
    "#eaff5a",
    "#5affc8",
    "#f2fff6",
  ],
  hazeStrong: "rgba(4, 42, 28, 0.86)",
  hazeSoft: "rgba(4, 42, 28, 0.4)",
};


export const CYAN_THEME: DataNetworkTheme = {
  void: "#00070b",
  boardCore: "#0b6577",
  boardEdge: "#03191f",
  grid: "rgba(110, 230, 255, 0.16)",
  landHot: "#e8feff",
  landCool: "#2ecfe4",
  link: "rgba(140, 245, 255, 0.42)",
  linkHot: "#c4f8ff",
  node: "#ffb347",
  nodeGlow: "rgba(255, 179, 71, 0.5)",
  panelFill: "rgba(28, 158, 184, 0.14)",
  panelStroke: "rgba(120, 235, 255, 0.32)",
  micro: "rgba(180, 240, 255, 0.62)",
  text: "#e2fbff",
  textDim: "rgba(190, 240, 255, 0.55)",
  accents: [
    "#00e5ff",
    "#2affd5",
    "#00b0d0",
    "#7df4ff",
    "#19d3c5",
    "#4fd8ff",
    "#00ffe0",
    "#e6fbff",
  ],
  hazeStrong: "rgba(3, 30, 40, 0.86)",
  hazeSoft: "rgba(3, 30, 40, 0.4)",
};

export const THEMES = {
  blue: BLUE_THEME,
  green: GREEN_THEME,
  cyan: CYAN_THEME,
} as const;

export type ThemeName = keyof typeof THEMES;
