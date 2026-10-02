// All colours for the six compositions live here. To make a new colour
// version, copy a palette, change the values, and register a composition in
// src/Root.tsx that passes it.

export type ChipPalette = {
  bgCenter: string;
  bgEdge: string;
  board: string;
  trace: string;
  traceBright: string;
  chipFill: string;
  chipEdge: string;
  alert: string; // main triangle colour
  alertCore: string; // hot core of the neon stroke
  alertRgb: string; // triangle colour as "r,g,b" for the light spill
  alertDeep: string; // dark fill inside the triangle
  warm: string; // corner glow, rgb triplet "r,g,b"
};

export const CHIP_RED: ChipPalette = {
  bgCenter: "#06125a",
  bgEdge: "#000108",
  board: "#00020f",
  trace: "#1d48ff",
  traceBright: "#68a8ff",
  chipFill: "#01041a",
  chipEdge: "#2456ff",
  alert: "#ff3a14",
  alertCore: "#ffe2b8",
  alertRgb: "255,58,20",
  alertDeep: "#5a0800",
  warm: "255,110,25",
};

export const CHIP_AMBER: ChipPalette = {
  bgCenter: "#053a35",
  bgEdge: "#000807",
  board: "#011a17",
  trace: "#0aa595",
  traceBright: "#4fe0cf",
  chipFill: "#01201c",
  chipEdge: "#16c9b4",
  alert: "#ffb300",
  alertCore: "#fff6d0",
  alertRgb: "255,179,0",
  alertDeep: "#4a2a00",
  warm: "255,140,20",
};

export type GlitchPalette = {
  bg: string;
  word: string;
  wordCore: string;
  code: string[];
  plexus: string;
};

export const GLITCH_RED: GlitchPalette = {
  bg: "#04050a",
  word: "#ff1e2d",
  wordCore: "#ff8a8f",
  code: ["#22c55e", "#3b82f6", "#ef4444"],
  plexus: "#9fb7d9",
};

export type HudPalette = {
  bgCenter: string;
  bgEdge: string;
  panel: string; // panel fill
  line: string; // panel borders, map outlines
  text: string; // code text, labels
  textAlt: string; // second code tint (cyan cast in the blue version)
  dim: string; // secondary text
  map: string; // map dots
  field: string; // field fill
  accent: string; // highlights, typed text
  alert: string; // warnings, flag frames
  alertCore: string;
};

export const HUD_BLUE: HudPalette = {
  bgCenter: "#173c74",
  bgEdge: "#030916",
  panel: "rgba(14,40,90,0.55)",
  line: "#eaf3ff",
  text: "#c4ecff",
  textAlt: "#66e2f4",
  dim: "#7aa8d8",
  map: "#e4f0ff",
  field: "rgba(2,10,28,0.8)",
  accent: "#ffffff",
  alert: "#ff3358",
  alertCore: "#ffc2cc",
};

export const HUD_GREEN: HudPalette = {
  bgCenter: "#04200e",
  bgEdge: "#000201",
  panel: "rgba(6,40,16,0.55)",
  line: "#7dffa8",
  text: "#7dffa6",
  textAlt: "#3ce07a",
  dim: "#1f9b4a",
  map: "#5dff92",
  field: "rgba(0,10,3,0.9)",
  accent: "#d4ffe2",
  alert: "#ff2a36",
  alertCore: "#ffc2c6",
};
