export type Palette = {
  // Background gradient: deep edges and the bright "horizon" glow at the top.
  bgDeep: string;
  bgMid: string;
  bgGlow: string;
  // Tints applied to the white text atlases.
  textNear: string;
  textFar: string;
  // Floating square / cross sprites.
  squareA: string;
  squareB: string;
  accent: string;
  bloomStrength: number;
  // Peak opacity of the ~4 s lens fly-by panel (bright palettes need less).
  heroPeak: number;
};

// Version 1: matches the reference's indigo/ultramarine look.
export const ULTRAMARINE: Palette = {
  bgDeep: "#050630",
  bgMid: "#091268",
  bgGlow: "#3a34e6",
  textNear: "#6c84ff",
  textFar: "#2533c0",
  squareA: "#3d5bff",
  squareB: "#7d93ff",
  accent: "#b8c6ff",
  bloomStrength: 0.6,
  heroPeak: 1.0,
};

// Version 2: alternative palette, emerald/teal data field with amber accents.
export const EMERALD: Palette = {
  bgDeep: "#010e0c",
  bgMid: "#03241f",
  bgGlow: "#0a7a60",
  textNear: "#33b08e",
  textFar: "#0a6e54",
  squareA: "#0f9e78",
  squareB: "#5ed9b6",
  accent: "#ffbf5a",
  bloomStrength: 0.5,
  heroPeak: 0.42,
};

export const PALETTES = { v1: ULTRAMARINE, v2: EMERALD } as const;
export type Variant = keyof typeof PALETTES;
