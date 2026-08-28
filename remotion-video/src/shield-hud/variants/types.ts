import type { Point } from "../geometry";
import type { DepthKey } from "../constants";

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
    /**
     * An optional second closed shape drawn inside the outline — an icon
     * within the glyph. The sweep never runs along it; it simply glows.
     * Both ratios are fractions of the frame height.
     */
    inner?: {
      outline: (height: number) => Point[];
      heightRatio: number;
      offsetYRatio: number;
    };
  };
  panelDensity: PanelDensity;
  panelBehaviour: PanelBehaviour;
  sweep: { mode: SweepMode; circuits: number };
  /** Horizontal slice tears plus channel split on the glyph. */
  glitch: boolean;
};

/** Three columns, roomy rows: one left of the glyph, two to its right. */
export const MEDIUM_DENSITY: PanelDensity = {
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

/**
 * Four columns, fourteen tighter rows, meters beside the two inner columns
 * and a scrolling log along the bottom — a visibly busier frame.
 */
export const HIGH_DENSITY: PanelDensity = {
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
