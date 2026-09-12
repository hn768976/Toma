// The two colour treatments requested: a faithful match of the reference
// clip (electric blue / white-hot core / magenta specks), and a dark-cyan
// variant that keeps the exact same choreography but shifts the whole
// scene into teal.

export type Palette = {
  /** CSS background behind the WebGL canvas, darkest first. */
  backgroundInner: string;
  backgroundOuter: string;
  /** Blown-out centre of the core. */
  coreInner: [number, number, number];
  /** Colour the core falls off to at its rim. */
  coreOuter: [number, number, number];
  /** Glow halo bleeding out of the core. */
  coreHalo: [number, number, number];
  /** Star-burst rays shooting off the core. */
  rays: [number, number, number];
  /** Filaments near the core... */
  filamentInner: [number, number, number];
  /** ...and at their far tips. */
  filamentOuter: [number, number, number];
  /** Dots riding the filaments. */
  node: [number, number, number];
  /** The sparse contrast colour among the dots and stars. */
  accent: [number, number, number];
  /** Background starfield. */
  star: [number, number, number];
  /** Overlay vignette colour. */
  vignette: string;
};

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

// Sampled off the reference frames: near-black navy field, a white core
// that bleeds to #7fd4ff, royal-blue filaments, cyan and magenta specks.
export const BLUE_PALETTE: Palette = {
  backgroundInner: "#0a1c38",
  backgroundOuter: "#02060f",
  coreInner: rgb("#ffffff"),
  coreOuter: rgb("#5cc8ff"),
  coreHalo: rgb("#1e7fe0"),
  rays: rgb("#a8e2ff"),
  filamentInner: rgb("#7cc4ff"),
  filamentOuter: rgb("#2f5fbf"),
  node: rgb("#46dcff"),
  accent: rgb("#ff2f6e"),
  star: rgb("#8fd8ff"),
  vignette: "rgba(1, 4, 11, 0.52)",
};

// Same scene, rotated into dark cyan: the field goes deep teal-black, the
// filaments and specks are all sea-green/aqua, and the magenta accent is
// replaced by a bright mint so the palette stays single-hued.
export const DARK_CYAN_PALETTE: Palette = {
  backgroundInner: "#032726",
  backgroundOuter: "#00070a",
  coreInner: rgb("#ffffff"),
  coreOuter: rgb("#22c8c2"),
  coreHalo: rgb("#06716f"),
  rays: rgb("#8bece4"),
  filamentInner: rgb("#40c9c0"),
  filamentOuter: rgb("#0c5154"),
  node: rgb("#17cfbe"),
  accent: rgb("#7cffe4"),
  star: rgb("#4dbdb6"),
  vignette: "rgba(0, 7, 9, 0.54)",
};

export const PALETTES = {
  blue: BLUE_PALETTE,
  darkCyan: DARK_CYAN_PALETTE,
} as const;

export type PaletteName = keyof typeof PALETTES;
