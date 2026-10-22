export type WorldPalette = {
  ocean: [string, string];
  /** Land tone ramp: shadow → highlight, as RGB 0-255. */
  landLo: [number, number, number];
  landHi: [number, number, number];
  coast: string;
  grid: string;
  text: string;
  dim: string;
  accent: string; // alerts, targets
  accentSoft: string;
  panel: string;
  panelEdge: string;
  highlight: string; // selection bars, progress
};

/** Reference: graphite map, cool grey land, red alerts. */
export const WORLD_REFERENCE: WorldPalette = {
  ocean: ["#0b0f10", "#161c1d"],
  landLo: [30, 36, 38],
  landHi: [228, 234, 234],
  coast: "rgba(220,230,230,0.35)",
  grid: "rgba(150,170,170,0.10)",
  text: "#dfe6e6",
  dim: "rgba(205,215,215,0.55)",
  accent: "#e0383e",
  accentSoft: "rgba(224,56,62,0.35)",
  panel: "rgba(26,30,32,0.82)",
  panelEdge: "rgba(160,175,175,0.35)",
  highlight: "#d9e2e2",
};

/** Alternative: deep-navy holographic grade with cyan land and amber alerts. */
export const WORLD_ALTERNATE: WorldPalette = {
  ocean: ["#020a18", "#06162c"],
  landLo: [8, 34, 60],
  landHi: [150, 232, 255],
  coast: "rgba(120,220,255,0.55)",
  grid: "rgba(80,170,255,0.14)",
  text: "#c9f1ff",
  dim: "rgba(140,210,240,0.6)",
  accent: "#ff9a2e",
  accentSoft: "rgba(255,154,46,0.35)",
  panel: "rgba(4,22,44,0.82)",
  panelEdge: "rgba(90,190,255,0.45)",
  highlight: "#7fe3ff",
};
