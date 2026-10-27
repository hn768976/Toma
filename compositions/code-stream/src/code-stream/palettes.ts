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
};

// Version 2: alternative palette, emerald/teal data field with amber accents.
export const EMERALD: Palette = {
  bgDeep: "#03201b",
  bgMid: "#063a33",
  bgGlow: "#0fa47f",
  textNear: "#52d9b5",
  textFar: "#0f9a74",
  squareA: "#14c495",
  squareB: "#8dffdc",
  accent: "#ffbf5a",
  bloomStrength: 0.6,
};

export const PALETTES = { v1: ULTRAMARINE, v2: EMERALD } as const;
export type Variant = keyof typeof PALETTES;
