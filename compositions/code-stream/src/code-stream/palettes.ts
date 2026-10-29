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
  // Tint of the fly-by panel.
  heroTint: string;
};

// Version 1: matches the reference's indigo/ultramarine look.
export const ULTRAMARINE: Palette = {
  bgDeep: "#050630",
  bgMid: "#0a1890",
  bgGlow: "#2438ff",
  textNear: "#a6c2ff",
  textFar: "#1d3cff",
  squareA: "#3360ff",
  squareB: "#6f9bff",
  accent: "#8fa8ff",
  bloomStrength: 0.6,
  heroPeak: 1.0,
  heroTint: "#b0b4ff",
};

// Version 2: alternative palette, emerald/teal data field with amber accents.
export const EMERALD: Palette = {
  bgDeep: "#010e0c",
  bgMid: "#073f35",
  bgGlow: "#12a07c",
  textNear: "#5fd9b4",
  textFar: "#14a07a",
  squareA: "#0f9e78",
  squareB: "#5ed9b6",
  accent: "#ffbf5a",
  bloomStrength: 0.6,
  heroPeak: 0.6,
  heroTint: "#ffd28a",
};

export const PALETTES = { v1: ULTRAMARINE, v2: EMERALD } as const;
export type Variant = keyof typeof PALETTES;
