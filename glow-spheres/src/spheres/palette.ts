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
  contourLine: "#160b46",
  stripes: [
    ["#f3c9ff", "#b04cf6", "#dc9cff", "#9a3cee"],
    ["#ecc0ff", "#9640ea", "#cf88fb", "#7f34dc"],
    ["#f3c9ff", "#bd58f8", "#9468f0", "#e3b0ff"],
    ["#d696fb", "#6a3cc0", "#a678f2", "#8a44e6"],
  ],
  darkSphere: "#221a58",
  darkSpecular: "#6b4fd8",
  coreLight: "#c879ff",
  fill: "#3a2a8f",
  streakTint: "#9a5cff",
  shard: "#251a5c",
  dimTint: "#9a46ee",
};

/** Version 2: electric cyan / teal – same mood, clearly different palette. */
export const CYAN_PALETTE: SpherePalette = {
  name: "electric-cyan",
  background: "#000508",
  contourLine: "#05283a",
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
