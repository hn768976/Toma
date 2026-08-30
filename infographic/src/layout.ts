/**
 * The panel layout is DATA. Every entry gives a chart type, a position and
 * size in sheet coordinates, and a stable seed. The renderer walks the array
 * and needs no knowledge of any particular arrangement, so a new layout mode
 * is a new array and nothing else.
 *
 * Sheet coordinates: the origin is the sheet's centre, +x runs along the
 * plane's receding axis, +y runs across it (down on screen). The sheet is much
 * larger than the frame in both directions, so no page edge is ever visible.
 *
 * One consequence of the tilt is worth knowing when editing these numbers: the
 * frame crops the sheet as a PARALLELOGRAM, not a rectangle. As x increases the
 * visible band of y slides by the stagger slope -b/d of the plane matrix
 * (about +0.22 for the -14 degree tilt, -0.17 for the +11 degree one). "dense"
 * answers this by staggering whole columns down that slope, so almost every
 * panel lands inside the crop. "sparse" instead keeps true sheet rows spanning
 * the full width, which is what lets one line chart run right across the sheet;
 * its rows therefore ride up and down with the tilt and crop at the frame edges.
 */

export type PanelKind =
  | "donut"
  | "bar"
  | "line"
  | "pie"
  | "text"
  | "valueRows"
  | "counter";

export type PanelSpec = {
  id: string;
  kind: PanelKind;
  /** Top-left corner in sheet coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Stable string seed. Every value on the panel derives from it. */
  seed: string;
};

// #region layout:dense
/**
 * "dense" — panels tightly packed with narrow gutters. Four columns, staggered
 * down the tilt so all 21 entries sit inside or across the crop and roughly 18
 * read at any moment. 6 donuts in a 3x2 grid as the centrepiece with the year
 * counter directly above them, 2 bar charts, 3 line charts, 3 pie charts,
 * 4 text blocks, 3 value-row groups.
 */
const dense: PanelSpec[] = [
  // Column L — the near side of the sheet, x centred near -1545.
  { id: "l1", kind: "text", x: -2232, y: -1897, w: 1374, h: 720, seed: "l1-text" },
  { id: "l2", kind: "line", x: -2232, y: -1141, w: 1374, h: 700, seed: "l2-line" },
  { id: "l3", kind: "pie", x: -2232, y: -405, w: 1374, h: 780, seed: "l3-pie" },
  { id: "l4", kind: "valueRows", x: -2232, y: 411, w: 1374, h: 812, seed: "l4-vr" },

  // Column C — the sharp middle band: counter above a 3x2 donut grid.
  { id: "c0", kind: "line", x: -786, y: -1560, w: 1572, h: 560, seed: "c0-line" },
  { id: "c1", kind: "valueRows", x: -786, y: -964, w: 1572, h: 380, seed: "c1-vr" },
  { id: "yc", kind: "counter", x: -786, y: -548, w: 780, h: 170, seed: "year" },
  { id: "d1", kind: "donut", x: -786, y: -342, w: 500, h: 540, seed: "donut-1" },
  { id: "d2", kind: "donut", x: -250, y: -342, w: 500, h: 540, seed: "donut-2" },
  { id: "d3", kind: "donut", x: 286, y: -342, w: 500, h: 540, seed: "donut-3" },
  { id: "d4", kind: "donut", x: -786, y: 234, w: 500, h: 540, seed: "donut-4" },
  { id: "d5", kind: "donut", x: -250, y: 234, w: 500, h: 540, seed: "donut-5" },
  { id: "d6", kind: "donut", x: 286, y: 234, w: 500, h: 540, seed: "donut-6" },
  { id: "c2", kind: "text", x: -786, y: 810, w: 1572, h: 750, seed: "c2-text" },

  // Column R1 — the far side, x centred near 1165.
  { id: "r1", kind: "pie", x: 822, y: -1306, w: 687, h: 700, seed: "r1-pie" },
  { id: "r2", kind: "bar", x: 822, y: -570, w: 687, h: 760, seed: "r2-bar" },
  { id: "r3", kind: "text", x: 822, y: 226, w: 687, h: 780, seed: "r3-text" },
  { id: "r4", kind: "valueRows", x: 822, y: 1042, w: 687, h: 772, seed: "r4-vr" },

  // Column R2 — the farthest column, x centred near 1888.
  { id: "q1", kind: "bar", x: 1545, y: -1148, w: 687, h: 760, seed: "q1-bar" },
  { id: "q2", kind: "pie", x: 1545, y: -352, w: 687, h: 700, seed: "q2-pie" },
  { id: "q3", kind: "line", x: 1545, y: 384, w: 687, h: 720, seed: "q3-line" },
  { id: "q4", kind: "text", x: 1545, y: 1140, w: 687, h: 832, seed: "q4-text" },
];
// #endregion

// #region layout:sparse
/**
 * "sparse" — a genuinely different arrangement, not v1 scaled up. 9 panels
 * instead of 21, each far larger, with gutters four to five times v1's so the
 * paper itself becomes an element rather than a background glimpsed between
 * panels. The 3x2 donut grid becomes a single row of three large donuts, and
 * one line chart spans most of the sheet's width as the dominant element.
 *
 * Panels are placed individually against the crop rather than in a column grid:
 * each sits inside the visible band for its own x, and the wide ones are left
 * to run off the frame edges, which is what makes the tilt read.
 */
const sparse: PanelSpec[] = [
  // The counter moves to the sheet's upper-left in this mode.
  { id: "yc", kind: "counter", x: -2150, y: -400, w: 820, h: 200, seed: "year" },
  { id: "s1", kind: "text", x: -2150, y: -140, w: 820, h: 780, seed: "s1-text" },
  { id: "s6", kind: "bar", x: -2150, y: 720, w: 820, h: 560, seed: "s6-bar" },

  // The single row of three large donuts.
  { id: "s2", kind: "donut", x: -1180, y: -620, w: 880, h: 820, seed: "donut-1" },
  { id: "s3", kind: "donut", x: -140, y: -620, w: 880, h: 820, seed: "donut-2" },
  { id: "s4", kind: "donut", x: 900, y: -620, w: 880, h: 820, seed: "donut-3" },

  // The dominant element, spanning most of the sheet's width.
  { id: "s5", kind: "line", x: -1180, y: 260, w: 3200, h: 620, seed: "s5-line" },

  { id: "s7", kind: "pie", x: 900, y: -1500, w: 800, h: 800, seed: "s7-pie" },
  { id: "s9", kind: "text", x: 1800, y: -1450, w: 900, h: 700, seed: "s9-text" },
  { id: "s8", kind: "bar", x: -1180, y: 940, w: 1500, h: 420, seed: "s8-bar" },
];
// #endregion

export const LAYOUTS: Record<string, PanelSpec[]> = {
  // #region layoutref:dense
  dense,
  // #endregion
  // #region layoutref:sparse
  sparse,
  // #endregion
};

export const getLayout = (mode: string): PanelSpec[] => {
  const l = LAYOUTS[mode];
  if (!l) {
    throw new Error(`Unknown layout mode "${mode}"`);
  }
  return l;
};
