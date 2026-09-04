export type Palette = {
  /** Corner colour of the background field. */
  bgOuter: string;
  bgMid: string;
  /** Centre colour of the background field. */
  bgInner: string;
  /** Rings, brackets, ticks, grid, dotted lines — everything low-contrast. */
  line: string;
  /** Data blocks: the brightest sustained colour in frame. */
  block: string;
  blockBright: string;
  /** Radar core. */
  core: string;
  /** Occasional accent, used sparingly. */
  accent: string;
};

export const BLUE: Palette = {
  bgOuter: "#020610",
  bgMid: "#030b18",
  bgInner: "#04101f",
  line: "#2a5a8a",
  block: "#2f8ae0",
  blockBright: "#5ab8ff",
  core: "#eaf4ff",
  accent: "#22d3ee",
};

export const AMBER: Palette = {
  bgOuter: "#0a0602",
  bgMid: "#120a03",
  bgInner: "#1a0e04",
  line: "#8a5a1a",
  block: "#e09020",
  blockBright: "#ffc060",
  core: "#fff4e6",
  accent: "#e04a2a",
};

export const PALETTES = { blue: BLUE, amber: AMBER };
export type PaletteName = keyof typeof PALETTES;
