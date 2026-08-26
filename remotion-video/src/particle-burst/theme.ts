// The ONLY place in this project where a colour literal is allowed.
// Everything downstream reads from THEMES / the parsed RGB table below.

export type Variant = "burst" | "implosion";

export type PaletteKey =
  | "backgroundDeep"
  | "backgroundMid"
  | "backgroundDark"
  | "particleCyan"
  | "particleWhite"
  | "particleBlue"
  | "particleMagenta"
  | "grain";

export type Palette = Record<PaletteKey, string>;

// Saturated royal blue, not black. The blue IS the piece's identity —
// darkening it would turn this into generic particle work.
const SHARED_PALETTE: Palette = {
  backgroundDeep: "#0A2FBF", // saturated royal blue
  backgroundMid: "#1540D4", // slightly brighter blue the field gradates toward
  backgroundDark: "#061A6B", // the soft dark centre vignette
  particleCyan: "#4FF5E8",
  particleWhite: "#E8FDFF", // the brightest grains, these bloom
  particleBlue: "#5FA8F5",
  particleMagenta: "#C46FE8", // sparse accent, ~8% of particles
  grain: "#FFFFFF",
};

// Burst and implosion share one palette on purpose: what separates the two
// is motion and timing, not colour. Recolouring would blur the pairing.
export const THEMES: Record<Variant, Palette> = {
  burst: SHARED_PALETTE,
  implosion: SHARED_PALETTE,
};

export type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

// Canvas work needs per-channel numbers (for rgba() with a live alpha), so
// each palette entry is parsed once at module load.
export const rgbOf = (variant: Variant, key: PaletteKey): Rgb =>
  parseHex(THEMES[variant][key]);

export const rgba = ({ r, g, b }: Rgb, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

export const solid = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;
