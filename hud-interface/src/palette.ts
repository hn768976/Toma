export type Variant = "v1" | "v2";

export type Palette = {
  smoke: [number, number, number]; // linear-ish RGB 0..1 for the shader
  smokeHi: [number, number, number];
  line: string; // primary HUD line colour
  text: string;
  fill: string; // solid bar fill
  panel: string; // translucent square fill
  accent: string; // small warning markers
  dot: string; // graph data points
  bar: string; // lavender underline bar
  grid: string;
};

// Version 1: teal / blue holographic interface (matches the reference).
export const TEAL: Palette = {
  smoke: [0.04, 0.27, 0.44],
  smokeHi: [0.10, 0.50, 0.74],
  line: "#6fd6dc",
  text: "#a6e6ea",
  fill: "#2f9aa3",
  panel: "#3aa6b4",
  accent: "#f07a3e",
  dot: "#f2e15a",
  bar: "#a497e6",
  grid: "#7fb8c8",
};

// Version 2: alternative amber "alert" palette - same interface, warm
// red/amber atmosphere with ice-white accents.
export const AMBER: Palette = {
  smoke: [0.46, 0.15, 0.03],
  smokeHi: [0.80, 0.36, 0.08],
  line: "#ffb35c",
  text: "#ffd7a3",
  fill: "#c8702a",
  panel: "#e08a3a",
  accent: "#ff7a2f",
  dot: "#e9f6ff",
  bar: "#ff6f8e",
  grid: "#d99a6a",
};

export const paletteFor = (v: Variant) => (v === "v1" ? TEAL : AMBER);
