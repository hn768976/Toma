// Timing, sizing and palettes for the "AI · Generating" loader piece.
//
// Two compositions share this file: a dark, 3D-tilted one (AiGeneratingDark)
// and a light, flat editorial one (AiGeneratingLight). Every geometric value
// here is authored at 1x = 1920x1080 and multiplied by the scale factor
// derived from useVideoConfig(), so the 1080p and 4K compositions are
// pixel-for-pixel the same framing at different resolutions.

export const FPS = 30;

// 8.000s — matched to the reference clip (240 frames @ 30fps).
export const DURATION_IN_FRAMES = 240;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Everything is laid out against BASE_WIDTH; scale() turns a 1x value into
// the value for the resolution currently being rendered.
export const scaleFor = (width: number) => width / BASE_WIDTH;

// --- Dark variant palette (reference-style) -------------------------------

export const DARK = {
  background: "#04060f",
  backgroundGlow: "#0b1430",
  vignette: "rgba(1, 2, 6, 0.82)",
  // Code-matrix inks, warm magenta/crimson with cold accents.
  codeHot: "#f43f5e",
  codeMid: "#c31d47",
  codeCool: "#7c1236",
  codeAccent: "#22d3ee",
  codeAccentSoft: "#3b82f6",
  // Foreground UI.
  ink: "#7fc0ff",
  inkBright: "#bfe2ff",
  emblem: "#3e9bff",
  emblemFaint: "rgba(62, 155, 255, 0.35)",
  trackTop: "#3d5a80",
  trackBottom: "#16263f",
  fillHot: "#ff2d55",
  fillDeep: "#b81340",
} as const;

// --- Light variant palette ------------------------------------------------

export const LIGHT = {
  background: "#eef1f8",
  panel: "#ffffff",
  panelEdge: "rgba(18, 28, 54, 0.08)",
  ink: "#101a33",
  inkSoft: "#5b6883",
  inkFaint: "#9aa4ba",
  indigo: "#3a5ce0",
  indigoSoft: "#c9d4fb",
  coral: "#f0436a",
  coralSoft: "#ffd3dd",
  teal: "#14a8a0",
  grid: "rgba(24, 38, 74, 0.055)",
  track: "#dde3f0",
} as const;

export const FONT_SANS = '"Montserrat", "Liberation Sans", Arial, sans-serif';
export const FONT_MONO = '"Roboto Mono", "Liberation Mono", monospace';
