// Colour palettes. Both HUD compositions share one component library and
// differ only by the theme they are handed plus their layout module, so a
// palette change never means touching a widget.

export type HudTheme = {
  id: string;
  // Backdrop
  bgBase: string;
  bgGlowInner: string;
  bgGlowOuter: string;
  vignette: string;
  // Grid + data field
  grid: string;
  gridMajor: string;
  mapDot: string;
  mapDotBright: string;
  blockDim: string;
  blockBright: string;
  // HUD linework
  line: string;
  lineSoft: string;
  lineFaint: string;
  accent: string;
  accentSoft: string;
  // Type
  text: string;
  textDim: string;
  chipFill: string;
  chipText: string;
  // Charts
  barFill: string;
  barTrack: string;
};

export const BLUE_THEME: HudTheme = {
  id: "blue",
  bgBase: "#061128",
  bgGlowInner: "rgba(38, 108, 196, 0.68)",
  bgGlowOuter: "rgba(8, 24, 58, 0)",
  vignette: "rgba(2, 6, 16, 0.72)",
  grid: "rgba(122, 190, 236, 0.085)",
  gridMajor: "rgba(122, 190, 236, 0.16)",
  mapDot: "rgba(96, 176, 240, 0.78)",
  mapDotBright: "rgba(134, 205, 255, 0.92)",
  blockDim: "rgba(29, 99, 176, 0.42)",
  blockBright: "rgba(74, 163, 232, 0.85)",
  line: "#dceeff",
  lineSoft: "rgba(202, 231, 255, 0.5)",
  lineFaint: "rgba(160, 205, 245, 0.24)",
  accent: "#5ecbff",
  accentSoft: "rgba(94, 203, 255, 0.35)",
  text: "#e6f3ff",
  textDim: "rgba(198, 226, 252, 0.52)",
  chipFill: "rgba(206, 229, 248, 0.82)",
  chipText: "#0a1c38",
  barFill: "#eaf5ff",
  barTrack: "rgba(120, 168, 214, 0.28)",
};

export const VIOLET_THEME: HudTheme = {
  id: "violet",
  bgBase: "#0d0620",
  bgGlowInner: "rgba(102, 34, 176, 0.46)",
  bgGlowOuter: "rgba(26, 6, 54, 0)",
  vignette: "rgba(5, 2, 12, 0.86)",
  grid: "rgba(196, 140, 255, 0.085)",
  gridMajor: "rgba(210, 150, 255, 0.17)",
  mapDot: "rgba(162, 100, 232, 0.6)",
  mapDotBright: "rgba(228, 168, 255, 0.85)",
  blockDim: "rgba(106, 43, 181, 0.44)",
  blockBright: "rgba(192, 91, 255, 0.85)",
  line: "#f2e2ff",
  lineSoft: "rgba(232, 208, 255, 0.5)",
  lineFaint: "rgba(206, 166, 250, 0.24)",
  accent: "#ff5ec8",
  accentSoft: "rgba(255, 94, 200, 0.35)",
  text: "#f6eaff",
  textDim: "rgba(226, 200, 252, 0.54)",
  chipFill: "rgba(234, 214, 252, 0.84)",
  chipText: "#22083f",
  barFill: "#f8ecff",
  barTrack: "rgba(164, 116, 214, 0.3)",
};

export const FONT_MONO = "'Share Tech Mono', 'DejaVu Sans Mono', monospace";
export const FONT_UI = "'Rajdhani', 'Liberation Sans', sans-serif";
