export type Palette = {
  /** Board base colour (darkest). */
  bg: string;
  /** Grid lines and grid dots. */
  grid: string;
  /** Growing bars. */
  bar: string;
  /** Pie wedges, square stacks, dot-matrix glyphs, area charts. */
  accent: string;
  /** Axes, line chart, text, pie icons. */
  ink: string;
  /** Dark half of the pie icons. */
  inkDark: string;
  /** Shader lighting: colour of the soft light pool (linear RGB 0..1). */
  light: [number, number, number];
  /** Shader lighting: colour of the shadowed corners (linear RGB 0..1). */
  shade: [number, number, number];
  /** CSS vignette colour. */
  vignette: string;
};

// Matches the reference: deep navy/teal board, aqua-green bars, cyan widgets.
export const oceanPalette: Palette = {
  bg: "#04273f",
  grid: "#2a8cc8",
  bar: "#00f065",
  accent: "#5fd8ee",
  ink: "#f2fbff",
  inkDark: "#08243a",
  light: [0.0, 0.36, 0.52],
  shade: [0.0, 0.04, 0.08],
  vignette: "rgba(1, 8, 16, 0.6)",
};

// Alternate version: warm "ember" palette — plum board, amber bars, coral widgets.
export const emberPalette: Palette = {
  bg: "#1a0918",
  grid: "#a8466a",
  bar: "#ffb33f",
  accent: "#ff7a7a",
  ink: "#fff3e3",
  inkDark: "#2a0c22",
  light: [0.55, 0.2, 0.28],
  shade: [0.03, 0.0, 0.02],
  vignette: "rgba(10, 2, 8, 0.6)",
};

export const palettes = { ocean: oceanPalette, ember: emberPalette } as const;
export type PaletteName = keyof typeof palettes;
