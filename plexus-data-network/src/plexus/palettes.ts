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
  /** Colours of the soft nebula haze clouds. */
  nebula: string[];
  /** Data labels. */
  labelRgb: [number, number, number];
  boxFill: string;
  boxText: string;
  vignette: string;
};

/** Version 1 - matches the reference: electric/royal blue data network. */
export const BLUE_PALETTE: PlexusPalette = {
  name: "Electric Blue",
  bgTop: "#010616",
  bgMid: "#06215a",
  bgBottom: "#0a3f96",
  floorGlow: "rgba(40, 140, 255, 0.34)",
  nodeCore: "#ffffff",
  nodeHalo: "#8cc4ff",
  lineRgb: [225, 240, 255],
  lineGlowRgb: [90, 165, 255],
  bokeh: ["#2f7bff", "#4b95ff", "#6fb0ff", "#9fd0ff", "#3a86f0", "#d8ecff"],
  nebula: ["#5aa9ff", "#7fc4ff", "#3d8cff"],
  labelRgb: [255, 255, 255],
  boxFill: "rgba(255, 255, 255, 1)",
  boxText: "#0a2150",
  vignette: "rgba(2, 10, 32, 0.8)",
};

/** Version 2 - alternative palette: molten amber / gold on a deep ember base. */
export const AMBER_PALETTE: PlexusPalette = {
  name: "Molten Amber",
  bgTop: "#080301",
  bgMid: "#2c1204",
  bgBottom: "#723206",
  floorGlow: "rgba(255, 150, 40, 0.42)",
  nodeCore: "#fffaf0",
  nodeHalo: "#ffc070",
  lineRgb: [255, 238, 210],
  lineGlowRgb: [255, 160, 60],
  bokeh: ["#ff8a1f", "#ffa63d", "#ffc56b", "#ffdca3", "#f09030", "#fff0d6"],
  nebula: ["#ffad55", "#ffc985", "#ff9a3a"],
  labelRgb: [255, 250, 240],
  boxFill: "rgba(255, 248, 236, 1)",
  boxText: "#3a1504",
  vignette: "rgba(24, 9, 2, 0.8)",
};
