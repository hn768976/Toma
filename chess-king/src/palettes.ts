export type Palette = {
  name: string;
  hero: { color: string; roughness: number; metalness: number };
  army: { color: string; roughness: number; sheen: string };
  boardLight: string;
  boardDark: string;
  backdropTop: string;
  backdropBottom: string;
  beam: string;
  fog: string;
  keyLight: string;
  rimLight: string;
  flash: string;
  dust: string;
};

// Matches the reference: gold king, glossy black army, warm grey stage.
export const GOLD_NOIR: Palette = {
  name: "Gold Noir",
  hero: { color: "#e3b55c", roughness: 0.2, metalness: 1 },
  army: { color: "#0d0d0f", roughness: 0.16, sheen: "#5a5a60" },
  boardLight: "#d9d7d2",
  boardDark: "#070707",
  backdropTop: "#3d3a33",
  backdropBottom: "#24221e",
  beam: "#fff3d6",
  fog: "#1c1b18",
  keyLight: "#fff2dc",
  rimLight: "#ffe9c4",
  flash: "#fff0d2",
  dust: "#fff1d0",
};

// Alternate grade: platinum king against a crimson army on a midnight stage.
export const PLATINUM_CRIMSON: Palette = {
  name: "Platinum Crimson",
  hero: { color: "#e6ebf2", roughness: 0.14, metalness: 1 },
  army: { color: "#5c0712", roughness: 0.18, sheen: "#ff6b7a" },
  boardLight: "#d6d9e0",
  boardDark: "#05070d",
  backdropTop: "#16203a",
  backdropBottom: "#080c18",
  beam: "#cfe6ff",
  fog: "#090d1a",
  keyLight: "#e6f0ff",
  rimLight: "#9fd2ff",
  flash: "#9fe3ff",
  dust: "#d8ecff",
};

export const PALETTES = { goldNoir: GOLD_NOIR, platinumCrimson: PLATINUM_CRIMSON };
export type PaletteId = keyof typeof PALETTES;
