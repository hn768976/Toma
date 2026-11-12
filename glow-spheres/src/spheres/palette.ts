/** Colour palettes. REFERENCE is sampled from the reference clip (k-means). */
export type SpherePalette = {
  name: string;
  background: string; // clear colour
  contourLine: string; // faint background contour lines
  stripes: readonly string[][]; // stripe colour sets (light -> saturated)
  darkSphere: string;
  darkSpecular: string;
  coreLight: string; // colour of the light inside the swarm
  fill: string; // dim fill light
  streakTint: string; // anamorphic streak colour
  shard: string;
  dimTint: string; // colour of weak glow at the edge of a light pocket
};

export const REFERENCE_PALETTE: SpherePalette = {
  name: "ultraviolet",
  background: "#020009",
  contourLine: "#0a0524",
  stripes: [
    ["#fbf2fd", "#b263f7", "#e2b6fb", "#a052f2"],
    ["#f6e8ff", "#9b55ee", "#d29ef9", "#8446e0"],
    ["#fbf2fd", "#bf6ff8", "#9a7cf3", "#ead0fc"],
    ["#d7a5f9", "#6b48c0", "#a98cf2", "#8a55e6"],
  ],
  darkSphere: "#221a58",
  darkSpecular: "#6b4fd8",
  coreLight: "#c09aff",
  fill: "#3a2a8f",
  streakTint: "#7a64ff",
  shard: "#251a5c",
  dimTint: "#5b3fd6",
};

/** Version 2: electric cyan / teal – same mood, clearly different palette. */
export const CYAN_PALETTE: SpherePalette = {
  name: "electric-cyan",
  background: "#000508",
  contourLine: "#02141b",
  stripes: [
    ["#f0feff", "#18c8e6", "#9ef3ff", "#0f9fc0"],
    ["#e4fbff", "#1b84c9", "#7fe3f7", "#136aa8"],
    ["#f0feff", "#22d3c5", "#4aa8f0", "#c8fbff"],
    ["#9ef3ff", "#0e5f86", "#36b9d8", "#1b84c9"],
  ],
  darkSphere: "#0a3442",
  darkSpecular: "#2fb8d8",
  coreLight: "#8ff0ff",
  fill: "#073346",
  streakTint: "#3fd2ff",
  shard: "#0a3140",
  dimTint: "#127ab8",
};
