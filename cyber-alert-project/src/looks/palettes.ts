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
  alertDeep: string; // dark fill inside the triangle
  warm: string; // corner glow, rgb triplet "r,g,b"
};

export const CHIP_RED: ChipPalette = {
  bgCenter: "#061a5c",
  bgEdge: "#01030f",
  board: "#020826",
  trace: "#1d4dff",
  traceBright: "#5f93ff",
  chipFill: "#030a2c",
  chipEdge: "#2a62ff",
  alert: "#ff3a1c",
  alertCore: "#fff0e6",
  alertDeep: "rgba(120,10,0,0.35)",
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
  alertCore: "#fff6d6",
  alertDeep: "rgba(110,60,0,0.35)",
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
  dim: string; // secondary text
  map: string; // map dots
  field: string; // field fill
  accent: string; // highlights, typed text
  alert: string; // warnings, flag frames
  alertCore: string;
};

export const HUD_BLUE: HudPalette = {
  bgCenter: "#0b2a5e",
  bgEdge: "#020814",
  panel: "rgba(14,40,90,0.55)",
  line: "#7fb2ff",
  text: "#cfe2ff",
  dim: "#6f93c9",
  map: "#a9c9ff",
  field: "rgba(4,16,40,0.85)",
  accent: "#e8f2ff",
  alert: "#ff2a2a",
  alertCore: "#ffd6d0",
};

export const HUD_GREEN: HudPalette = {
  bgCenter: "#062612",
  bgEdge: "#000302",
  panel: "rgba(6,40,16,0.55)",
  line: "#3dff7a",
  text: "#7dffa6",
  dim: "#1f9b4a",
  map: "#4dff86",
  field: "rgba(0,14,4,0.88)",
  accent: "#c8ffd9",
  alert: "#ff2a2a",
  alertCore: "#ffd6d0",
};
