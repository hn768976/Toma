export type Theme = {
  bgInner: string;
  bgMid: string;
  bgOuter: string;
  coreGlow: string;
  trace: [string, string, string]; // dim -> mid -> bright
  ring: string;
  ringSoft: string;
  pad: string;
  pulse: string;
  pulseCore: string;
  label: string;
  dust: string;
};

// V1 — blue/cyan, matching the reference clip.
export const BLUE: Theme = {
  bgInner: "#0d2b57",
  bgMid: "#071c3c",
  bgOuter: "#04122e",
  coreGlow: "#2a6fc4",
  trace: ["#1b4a9e", "#2f8ae0", "#7ac8ff"],
  ring: "#22d3ee",
  ringSoft: "#7ae8f8",
  pad: "#3f7fd0",
  pulse: "#7ac8ff",
  pulseCore: "#eaf7ff",
  label: "#4a8fd8",
  dust: "#2f8ae0",
};

// V2 — amber/gold on near-black, the industrial counterpart.
export const AMBER: Theme = {
  bgInner: "#1f1204",
  bgMid: "#120a02",
  bgOuter: "#0a0601",
  coreGlow: "#7a4708",
  trace: ["#8a5010", "#e0a020", "#ffd88a"],
  ring: "#ffb020",
  ringSoft: "#ffd88a",
  pad: "#b57a1c",
  pulse: "#ffd88a",
  pulseCore: "#fff6e2",
  label: "#a9701c",
  dust: "#e0a020",
};
