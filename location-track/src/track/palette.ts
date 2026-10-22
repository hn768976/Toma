// Colour palettes. V1 matches the reference's cold steel-blue grade; V2 is the
// alternative "thermal amber" grade (warm sodium-vapour tones, cyan targets for
// contrast). Map tones are applied in the shader, HUD colours in the SVG overlay.

export type Rgb = [number, number, number];

export type Palette = {
  // Map grade: luminance 0 -> shadow, 0.5 -> mid, 1 -> high.
  shadow: Rgb;
  mid: Rgb;
  high: Rgb;
  mapLine: Rgb; // GIS overlay line-work on the map
  hud: string; // primary HUD lines
  hudText: string;
  hudDim: string;
  panel: string; // left panel fill
  warn: string;
  target: string; // rings on the hubs
  marker: string; // triangles
};

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export const STEEL_BLUE: Palette = {
  shadow: hex("#03070d"),
  mid: hex("#2d5274"),
  high: hex("#d7e6f3"),
  mapLine: hex("#9fd2ff"),
  hud: "#8fd0ff",
  hudText: "#dceeff",
  hudDim: "rgba(170, 210, 240, 0.55)",
  panel: "rgba(3, 8, 15, 0.82)",
  warn: "#ff3a2e",
  target: "#d6d23a",
  marker: "#3a6cff",
};

export const THERMAL_AMBER: Palette = {
  shadow: hex("#080402"),
  mid: hex("#6a3a12"),
  high: hex("#ffe1b0"),
  mapLine: hex("#ffc066"),
  hud: "#ffb85c",
  hudText: "#fff0d8",
  hudDim: "rgba(255, 210, 150, 0.55)",
  panel: "rgba(14, 7, 2, 0.84)",
  warn: "#ff3a2e",
  target: "#4fe3ff",
  marker: "#ffffff",
};
