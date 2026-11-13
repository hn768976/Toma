export type Palette = {
  name: string;
  background: string; // clear colour (sRGB)
  lift: [number, number, number]; // linear shadow tint added in grade
  areaTop: string; // area chart fill near the curve
  areaBottom: string;
  areaEdge: string;
  grid: string;
  text: string;
  textDim: string;
  curveA: string; // falling curve (red in the reference)
  curveB: string; // rising curve (green in the reference)
  candleUp: string;
  candleDown: string;
  candleGlow: string;
  lineA: string; // zig-zag overlay line (pink in the reference)
  lineB: string; // second overlay line (yellow in the reference)
  frame: string;
  glowBar: string; // foreground light bar (orange in the reference)
  accent: string; // cyan highlight bars on side panels
  accentWarm: string; // small red mini charts on side panels
  donut: string[];
  floorCell: string;
  floorBlip: string;
  glassRgb: string; // "r,g,b" tint of glass panel fills
  humpRgb: string; // background area hump on the candle panel
  dataRgb: string; // faint data bars
  uiRgb: string; // placeholder text rows on side panels
};

/** Version 1 — matches the reference: navy UI, red/green curves, orange bar. */
export const REFERENCE_PALETTE: Palette = {
  name: "reference",
  background: "#02040a",
  lift: [0.0018, 0.0032, 0.0085],
  areaTop: "rgba(120, 155, 205, 0.50)",
  areaBottom: "rgba(70, 100, 155, 0.20)",
  areaEdge: "rgba(150, 195, 255, 0.95)",
  grid: "rgba(190, 210, 240, 0.30)",
  text: "rgba(235, 242, 255, 0.95)",
  textDim: "rgba(200, 215, 240, 0.55)",
  curveA: "#ff2a2a",
  curveB: "#9bff6a",
  candleUp: "#6fe6ff",
  candleDown: "#b582ff",
  candleGlow: "#6fa8ff",
  lineA: "#ff2f6e",
  lineB: "#ffd34a",
  frame: "rgba(140, 175, 230, 0.35)",
  glowBar: "#ff7a14",
  accent: "#3ff0d8",
  accentWarm: "#ff3b4e",
  donut: ["#ff3b3b", "#ff9d2e", "#ffe14a", "#4dff8a", "#33d6ff", "#4a6dff"],
  floorCell: "rgba(80, 95, 125, 0.17)",
  floorBlip: "rgba(230, 240, 255, 0.95)",
  glassRgb: "40,70,135",
  humpRgb: "30,60,120",
  dataRgb: "140,190,255",
  uiRgb: "200,215,240",
};

/**
 * Version 2 — alternative colour palette "Amber Night": warm gold area chart,
 * teal / magenta crossing curves, gold-white candles, cyan foreground light bar
 * on a warm charcoal background. Same layout, data, timing and camera path.
 */
export const AMBER_PALETTE: Palette = {
  name: "amber",
  background: "#070403",
  lift: [0.0075, 0.0035, 0.0012],
  areaTop: "rgba(255, 168, 52, 0.78)",
  areaBottom: "rgba(150, 70, 18, 0.30)",
  areaEdge: "rgba(255, 220, 150, 0.95)",
  grid: "rgba(255, 225, 190, 0.28)",
  text: "rgba(255, 244, 228, 0.95)",
  textDim: "rgba(255, 225, 190, 0.55)",
  curveA: "#ff3fa4",
  curveB: "#32f5e0",
  candleUp: "#ffe39a",
  candleDown: "#ff8a4c",
  candleGlow: "#ffb347",
  lineA: "#39d7ff",
  lineB: "#d9ff4a",
  frame: "rgba(255, 196, 130, 0.35)",
  glowBar: "#29d8ff",
  accent: "#ffcf3f",
  accentWarm: "#ff4f9a",
  donut: ["#ff4f9a", "#ff8a3c", "#ffd84a", "#d9ff4a", "#32f5e0", "#29a8ff"],
  floorCell: "rgba(135, 100, 70, 0.17)",
  floorBlip: "rgba(255, 238, 210, 0.95)",
  glassRgb: "135,80,35",
  humpRgb: "120,55,20",
  dataRgb: "255,190,120",
  uiRgb: "245,220,190",
};
