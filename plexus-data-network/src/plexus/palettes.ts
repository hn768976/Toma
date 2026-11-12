export type PlexusPalette = {
  name: string;
  /** Background vertical gradient (top -> bottom). */
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  /** Large soft glow that lights the lower half of the frame. */
  floorGlow: string;
  /** Node core and halo. */
  nodeCore: string;
  nodeHalo: string;
  /** Connection lines (RGB triplet so alpha can be varied per line end). */
  lineRgb: [number, number, number];
  lineGlowRgb: [number, number, number];
  /** Colours of out-of-focus bokeh particles. */
  bokeh: string[];
  /** Data labels. */
  labelRgb: [number, number, number];
  boxFill: string;
  boxText: string;
  vignette: string;
};

/** Version 1 - matches the reference: electric/royal blue data network. */
export const BLUE_PALETTE: PlexusPalette = {
  name: "Electric Blue",
  bgTop: "#01061a",
  bgMid: "#06215e",
  bgBottom: "#0b4fb8",
  floorGlow: "rgba(40, 125, 255, 0.55)",
  nodeCore: "#ffffff",
  nodeHalo: "#5aa8ff",
  lineRgb: [214, 234, 255],
  lineGlowRgb: [70, 150, 255],
  bokeh: ["#2f7bff", "#4b95ff", "#6fb0ff", "#9fd0ff", "#1f5fe0", "#c9e4ff"],
  labelRgb: [235, 245, 255],
  boxFill: "rgba(240, 248, 255, 0.95)",
  boxText: "#06215e",
  vignette: "rgba(0, 3, 14, 0.85)",
};

/** Version 2 - alternative palette: molten amber / gold on a deep ember base. */
export const AMBER_PALETTE: PlexusPalette = {
  name: "Molten Amber",
  bgTop: "#070302",
  bgMid: "#2b1004",
  bgBottom: "#8a3c06",
  floorGlow: "rgba(255, 140, 30, 0.5)",
  nodeCore: "#fffaf0",
  nodeHalo: "#ffab3d",
  lineRgb: [255, 232, 196],
  lineGlowRgb: [255, 150, 45],
  bokeh: ["#ff8a1f", "#ffa63d", "#ffc56b", "#ffdca3", "#e0661a", "#fff0d6"],
  labelRgb: [255, 243, 224],
  boxFill: "rgba(255, 244, 226, 0.95)",
  boxText: "#3a1504",
  vignette: "rgba(10, 4, 0, 0.85)",
};
