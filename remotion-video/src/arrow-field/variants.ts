/**
 * The single source of truth for everything that differs between the two
 * arrow-field clips.
 *
 * Two rules this file exists to enforce:
 *   1. NO HEX LITERAL LIVES ANYWHERE ELSE in the arrow-field. Every colour the
 *      field paints is read out of `VARIANTS[variant].palette`.
 *   2. Arrow direction and drift axis are SIGNED CONFIG VALUES on one
 *      implementation. `green` is `red` with both signs flipped. There is no
 *      second copy of the field.
 *
 * Direction must match meaning: red arrows fall, green arrows rise. The drift
 * axis always matches the arrows, so a red field sinks and a green field lifts.
 */

export type VariantName = "red" | "green";

export type Palette = {
  /** Near-black tone that fills the empty corner. */
  bgDeep: string;
  /** Mid stop of the corner-to-corner background gradient. */
  bgMid: string;
  /** Saturated hue at the dense corner. */
  bgHot: string;
  arrowFill: string;
  arrowEdge: string;
  shardFill: string;
  shardEdge: string;
  sparkPale: string;
};

/** Normalised frame corner, each component 0 or 1 (x: 0 left/1 right, y: 0 top/1 bottom). */
export type Corner = { x: 0 | 1; y: 0 | 1 };

export type Variant = {
  palette: Palette;
  /**
   * Unit-ish vector the arrows point along, in screen space (+y is down).
   * The drift axis IS this vector — elements travel the way they point.
   */
  drift: { x: number; y: number };
  /** Corner holding the dense mass of the field. The opposite corner is left open for copy. */
  densityCorner: Corner;
  /** Corner left dark and nearly empty — where a buyer puts their headline. */
  copyCorner: Corner;
  /** Arrows drawn as an unfilled outline at larger scale. 0 in v1. */
  outlineArrowCount: number;
};

const RED: Variant = {
  palette: {
    bgDeep: "#1A0206",
    bgMid: "#6B0A14",
    bgHot: "#C41028",
    arrowFill: "#E8304A",
    arrowEdge: "#FF6A7A",
    shardFill: "#A81020",
    shardEdge: "#E8506A",
    sparkPale: "#FFC4CC",
  },
  // Down, and slightly left.
  drift: { x: -0.28, y: 1 },
  densityCorner: { x: 1, y: 0 }, // upper-right
  copyCorner: { x: 0, y: 1 }, // lower-left
  outlineArrowCount: 0,
};

const GREEN: Variant = {
  palette: {
    bgDeep: "#01140A",
    bgMid: "#06481F",
    bgHot: "#10A83F",
    arrowFill: "#2ED45F",
    arrowEdge: "#7FFFA0",
    shardFill: "#14A83F",
    shardEdge: "#5FE88A",
    sparkPale: "#C8FFD8",
  },
  // Up, and slightly right — the exact negation of RED.drift.
  drift: { x: -RED.drift.x, y: -RED.drift.y },
  // Not a vertical mirror of v1: the open corner moves diagonally, so the two
  // clips leave copy space in different places and can share one edit.
  densityCorner: { x: 1, y: 1 }, // lower-right
  copyCorner: { x: 0, y: 0 }, // upper-left
  outlineArrowCount: 8,
};

export const VARIANTS: Record<VariantName, Variant> = { red: RED, green: GREEN };
