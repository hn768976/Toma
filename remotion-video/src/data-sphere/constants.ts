// Timing, layout, and palette config for the data-sphere HUD.
// All layout values live in a fixed 1920x1080 "design space". The HUD is
// an SVG with that viewBox and the sphere canvas scales its coordinates by
// (actual width / DESIGN_WIDTH), so the 1080p and 4K compositions are
// pixel-for-pixel the same frame, just sharper at 4K.

export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s, same length as the reference

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

// Sphere placement (design space).
export const SPHERE_CENTER_X = 796;
export const SPHERE_CENTER_Y = 532;
export const SPHERE_RADIUS = 262;

// Sphere content.
export const STRAND_COUNT = 260; // curvy strands wrapped around the sphere
export const STRAND_POINTS = 150; // samples per strand
export const DOT_COUNT = 2000; // loose "data point" dots on the surface

export const ROTATION_SPEED = 0.16; // rad / s around the vertical axis
export const AXIAL_TILT = 0.32; // rad, tilts the spin axis toward the camera

// The sphere morphs dots -> long tangled strands -> dots. tangle(t) is
// 0 for the dotted look and 1 for the full tangle, t in seconds.
export const TANGLE_IN_START = 1.6;
export const TANGLE_IN_END = 5.6;
export const TANGLE_OUT_START = 10.4;
export const TANGLE_OUT_END = 14.4;

export type Palette = {
  background: string;
  vignette: string;
  // Sphere colors are "r, g, b" triplets so alpha can be varied per depth.
  sphereLine: string;
  sphereDot: string;
  glowOpacity: number;
  hudLine: string; // long ruler lines
  hudTick: string; // crosses, ticks, dots at line ends
  hudText: string; // ruler numbers and data readouts
  hudTextDim: string; // far-left small readout
  bar: string;
  barAccent: string; // tallest bar(s) per frame
};

// Version 1 — matches the reference: white on black, grey bars.
export const MONO_PALETTE: Palette = {
  background: "#030303",
  vignette: "rgba(0, 0, 0, 0.55)",
  sphereLine: "236, 236, 236",
  sphereDot: "255, 255, 255",
  glowOpacity: 0.35,
  hudLine: "rgba(210, 210, 210, 0.42)",
  hudTick: "rgba(220, 220, 220, 0.55)",
  hudText: "rgba(220, 220, 220, 0.75)",
  hudTextDim: "rgba(200, 200, 200, 0.4)",
  bar: "rgba(150, 150, 150, 0.85)",
  barAccent: "rgba(190, 190, 190, 0.95)",
};

// Version 2 — alternate palette: warm amber sphere over a deep
// teal-black field with teal HUD chrome and coral accents.
export const EMBER_PALETTE: Palette = {
  background: "#04121a",
  vignette: "rgba(1, 6, 10, 0.65)",
  sphereLine: "255, 176, 92",
  sphereDot: "255, 228, 186",
  glowOpacity: 0.55,
  hudLine: "rgba(74, 178, 170, 0.38)",
  hudTick: "rgba(110, 206, 196, 0.55)",
  hudText: "rgba(140, 220, 210, 0.8)",
  hudTextDim: "rgba(110, 190, 182, 0.42)",
  bar: "rgba(74, 178, 170, 0.8)",
  barAccent: "rgba(255, 122, 89, 0.95)",
};

export const PALETTES = {
  mono: MONO_PALETTE,
  ember: EMBER_PALETTE,
} as const;

export type PaletteName = keyof typeof PALETTES;
