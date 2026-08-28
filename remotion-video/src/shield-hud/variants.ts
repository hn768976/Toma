import { keyholeOutline, shieldOutline } from "./paths";
import type { Point } from "./geometry";
import type { DepthKey } from "./constants";

export type VariantKey = "blue" | "green" | "breach";

export type Palette = {
  backgroundDeep: string;
  backgroundWash: string;
  glyphMid: string;
  glyphPale: string;
  glyphWhite: string;
  accent: string;
  readoutWhite: string;
  readoutDim: string;
  tickPale: string;
};

export type ColumnSpec = {
  x: number;
  depth: DepthKey;
  /** Renders a bar meter alongside the column's values. */
  meter: boolean;
};

export type PanelDensity = {
  name: "medium" | "high";
  columns: ColumnSpec[];
  rows: number;
  rowGap: number;
  fontSize: number;
  /** Scrolling log rows along the bottom of the plane. */
  logStrip: boolean;
};

export type PanelBehaviour = "steady" | "active" | "failing";
export type SweepMode = "smooth" | "stutter";
export type GlyphIntegrity = "solid" | "fractured";

export type Variant = {
  palette: Palette;
  /** The centre glyph's path, as data: an outline builder plus its size. */
  glyph: {
    outline: (height: number) => Point[];
    heightRatio: number;
    integrity: GlyphIntegrity;
  };
  panelDensity: PanelDensity;
  panelBehaviour: PanelBehaviour;
  sweep: { mode: SweepMode; circuits: number };
  /** Horizontal slice tears plus channel split on the glyph. */
  glitch: boolean;
};

// Three columns, roomy rows: one to the left of the glyph, two to its right.
const MEDIUM_DENSITY: PanelDensity = {
  name: "medium",
  columns: [
    { x: 780, depth: "mid", meter: false },
    { x: 2520, depth: "near", meter: false },
    { x: 3010, depth: "mid", meter: false },
  ],
  rows: 9,
  rowGap: 88,
  fontSize: 46,
  logStrip: false,
};

// Four columns, fourteen tighter rows, meters on the two inner columns and a
// scrolling log along the bottom — a visibly busier frame.
const HIGH_DENSITY: PanelDensity = {
  name: "high",
  columns: [
    { x: 700, depth: "mid", meter: false },
    { x: 2430, depth: "near", meter: true },
    { x: 2880, depth: "near", meter: true },
    { x: 3330, depth: "mid", meter: false },
  ],
  rows: 14,
  rowGap: 64,
  fontSize: 38,
  logStrip: true,
};

/**
 * Every difference between the three versions lives here. Nothing else in
 * the project carries a hex value or a glyph shape.
 */
export const VARIANTS: Record<VariantKey, Variant> = {
  blue: {
    palette: {
      backgroundDeep: "#050B33",
      backgroundWash: "#0F1B5C",
      glyphMid: "#3F7FFF",
      glyphPale: "#A8C8FF",
      glyphWhite: "#F0F6FF",
      accent: "#D44FC4",
      readoutWhite: "#E8EEF8",
      readoutDim: "#6A7AB0",
      tickPale: "#8A9AD4",
    },
    glyph: { outline: shieldOutline, heightRatio: 0.45, integrity: "solid" },
    panelDensity: MEDIUM_DENSITY,
    panelBehaviour: "steady",
    sweep: { mode: "smooth", circuits: 2 },
    glitch: false,
  },
  green: {
    palette: {
      backgroundDeep: "#021A0C",
      backgroundWash: "#064220",
      glyphMid: "#3FE87A",
      glyphPale: "#A8FFC4",
      glyphWhite: "#F0FFF4",
      accent: "#F5B02E",
      readoutWhite: "#E8FFEE",
      readoutDim: "#5FA878",
      tickPale: "#8AD4A0",
    },
    glyph: { outline: keyholeOutline, heightRatio: 0.38, integrity: "solid" },
    panelDensity: HIGH_DENSITY,
    panelBehaviour: "active",
    sweep: { mode: "smooth", circuits: 3 },
    glitch: false,
  },
  breach: {
    palette: {
      backgroundDeep: "#140303",
      backgroundWash: "#4A0E10",
      glyphMid: "#FF3F4F",
      glyphPale: "#FFA8B0",
      glyphWhite: "#FFF0F0",
      accent: "#FF7A28",
      readoutWhite: "#FFE8E8",
      readoutDim: "#A86A6A",
      tickPale: "#D48A8A",
    },
    glyph: { outline: shieldOutline, heightRatio: 0.45, integrity: "fractured" },
    panelDensity: HIGH_DENSITY,
    panelBehaviour: "failing",
    sweep: { mode: "stutter", circuits: 2 },
    glitch: true,
  },
};
