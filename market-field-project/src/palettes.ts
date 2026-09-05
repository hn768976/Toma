/**
 * The two colourways. Background, map, grain and vignette are identical
 * between them — only the series and bar colours change.
 */

export type Palette = {
  id: string;
  /** Series that occupies the lower-left and rises to the right. */
  rising: { stroke: string; fill: string };
  /** Series that generally descends, crossing the other mid-frame. */
  falling: { stroke: string; fill: string };
  /** Tint added where the two filled areas intersect. */
  overlap: string;
  /** How hard that tint is pushed — the darker fills need less of it. */
  overlapStrength: number;
  /** Multiplier on the fill opacity, to even out darker fill colours. */
  fillBoost: number;
  /** Bokeh candlestick colours, drawn additively. */
  bars: readonly string[];
  barWeights: readonly number[];
};

export const VIOLET: Palette = {
  id: "violet",
  rising: { stroke: "#7a3ce8", fill: "#4a1a9e" },
  falling: { stroke: "#f062c0", fill: "#8a2a6a" },
  overlap: "#a06ae8",
  overlapStrength: 1,
  fillBoost: 1,
  bars: ["#f062c0", "#6ad8f0", "#ffffff"],
  barWeights: [0.38, 0.36, 0.26],
};

export const GREEN_RED: Palette = {
  id: "green-red",
  rising: { stroke: "#16c784", fill: "#0a5a3a" },
  falling: { stroke: "#ea3943", fill: "#6a1a20" },
  // Green over red resolves to amber; pulled grey so it stays a blend and
  // not a third colour competing with the two series.
  overlap: "#9c7a48",
  overlapStrength: 0.26,
  fillBoost: 1.45,
  bars: ["#16c784", "#ea3943", "#ffffff"],
  barWeights: [0.36, 0.34, 0.3],
};

export const BACKGROUND = "#050208";
export const MAP_COLOR = "#101013";
