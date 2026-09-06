import { createContext, useContext } from "react";

export type Theme = {
  /** Primary strokes and readable text. */
  primary: string;
  /** Secondary text and mid-contrast structure. */
  secondary: string;
  /** Structural grid, hairline dividers, dormant ticks. */
  structure: string;
  /** Filled bars and meters. */
  bar: string;
  /** Slightly lifted background panes behind the interface. */
  lift: string;
  /** Colour used for the CRT glow on the brightest elements. */
  glow: string;
};

// V1 - monochrome. The greyscale is the point: it reads film-grade rather
// than generic sci-fi, so no hue creeps into any of these values.
export const THEME_MONO: Theme = {
  primary: "#f0f0f0",
  secondary: "#9a9a9a",
  structure: "#3a3a3a",
  bar: "#c8c8c8",
  lift: "#0a0a0a",
  glow: "rgba(240, 240, 240, 0.45)",
};

// V2 - the same layout with white replaced by pale cyan and the dim
// structure in steel blue.
export const THEME_CYAN: Theme = {
  primary: "#d0f4ff",
  secondary: "#7aa8c0",
  structure: "#2a4a5a",
  bar: "#a0d8ec",
  lift: "#050d12",
  glow: "rgba(160, 216, 236, 0.45)",
};

export const ThemeContext = createContext<Theme>(THEME_MONO);

export const useTheme = (): Theme => useContext(ThemeContext);
