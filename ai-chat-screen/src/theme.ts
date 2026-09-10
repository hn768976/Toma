export const EDITOR_BG = "#0d1117";
export const GUTTER_BG = "#161b22";
export const SIDEBAR_BG = "#0a0d12";

// One-Dark-ish syntax palette. Prism token types are mapped onto these
// seven roles in code/highlight.ts.
export const SYNTAX = {
  keyword: "#c678dd",
  string: "#e5c07b",
  func: "#61afef",
  comment: "#5c6370",
  type: "#56b6c2",
  number: "#d19a66",
  plain: "#c9d1d9",
} as const;

export type SyntaxRole = keyof typeof SYNTAX;

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export const rgbaString = ({ r, g, b }: Rgb, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;

// The orb is never monochrome: dots are coloured by where they sit on the
// screen-space diagonal, `from` at the upper left through `to` at the
// lower right.
export type OrbPalette = {
  from: string;
  to: string;
  glow: string;
};

export const ORB_CYAN: OrbPalette = {
  from: "#22d3ee",
  to: "#7a4ae8",
  glow: "#4a86e8",
};

export const ORB_AMBER: OrbPalette = {
  from: "#f0a020",
  to: "#e04a10",
  glow: "#e8761c",
};
