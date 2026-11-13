export type Palette = {
  name: string;
  /** Screen background. */
  bg: string;
  /** Faint background grid crosses. */
  grid: string;
  /** Vignette edge colour (rgba). */
  vignette: string;
  /** Primary bright text. */
  text: string;
  /** Secondary / dim text. */
  dim: string;
  /** Dim digits in the main number grid. */
  gridDim: string;
  /** Very dim text (tiny captions). */
  faint: string;
  /** Main accent (orange in the reference). */
  accent: string;
  /** Accent at low intensity. */
  accentDim: string;
  /** Secondary accent (teal in the reference). */
  accent2: string;
  /** Bar / tag colour (steel blue in the reference). */
  bar: string;
  /** Header chip / highlight fill. */
  chip: string;
  /** Card fill. */
  card: string;
  /** Card corner triangle (green in the reference). */
  cardCorner: string;
  /** Box outlines. */
  outline: string;
  /** Panels (graph box). */
  panel: string;
  /** Top-right info box fill, header bar and value colour. */
  infoPanel: string;
  infoHeader: string;
  infoValue: string;
  /** Additive glow strength for bright elements (0 = none). */
  glow: number;
};

/** Version 1: neutral charcoal, warm orange + teal accents (matches reference). */
export const REFERENCE: Palette = {
  name: "reference",
  bg: "#0f1010",
  grid: "rgba(255,255,255,0.045)",
  vignette: "rgba(0,0,0,0.55)",
  text: "#e4e4e2",
  dim: "#8e8f8f",
  gridDim: "#6e7070",
  faint: "#5d5f60",
  accent: "#f2a33a",
  accentDim: "#7a5426",
  accent2: "#2fe6cb",
  bar: "#6c90bc",
  chip: "#4f5868",
  card: "#4c5163",
  cardCorner: "#5fc46c",
  outline: "#4a4c4f",
  panel: "#202324",
  infoPanel: "#2a302c",
  infoHeader: "#8f9a92",
  infoValue: "#f3e3a1",
  glow: 0.25,
};

/** Version 2: deep navy, ice-cyan text, hot-magenta + electric-cyan accents. */
export const NEON: Palette = {
  name: "neon",
  bg: "#070b1c",
  grid: "rgba(110,170,255,0.06)",
  vignette: "rgba(2,0,12,0.7)",
  text: "#d8f1ff",
  dim: "#6f8fb8",
  gridDim: "#54709a",
  faint: "#3b4f75",
  accent: "#ff3d9a",
  accentDim: "#6e1d4c",
  accent2: "#38e8ff",
  bar: "#8b6dff",
  chip: "#2d2f72",
  card: "#28306a",
  cardCorner: "#ff3d9a",
  outline: "#2f3f6e",
  panel: "#0e1531",
  infoPanel: "#16204a",
  infoHeader: "#7f8fd8",
  infoValue: "#ff8fc6",
  glow: 0.6,
};
