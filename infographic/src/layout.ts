/**
 * The panel layout is DATA. Every entry gives a chart type, a position and
 * size in sheet coordinates, and a stable seed. The renderer walks the array
 * and needs no knowledge of any particular arrangement, so a new layout mode
 * is a new array and nothing else.
 *
 * Sheet coordinates: the origin is the sheet's centre, +x runs along the
 * plane's receding axis, +y runs across it (down on screen). The sheet is much
 * larger than the frame in both directions, so no page edge is ever visible.
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
 * "dense" — panels tightly packed with narrow gutters, roughly 18 of the 21
 * entries inside the crop at any moment. 6 donuts in a 3x2 grid as the
 * centrepiece, 2 bar charts, 3 line charts, 3 pie charts, 4 text blocks,
 * 3 value-row groups. The array runs wider than the crop so the drift always
 * has fresh content to bring in from the right.
 */
const dense: PanelSpec[] = [
  // Column A — drifts out of frame to the left over the shot.
  { id: "a1", kind: "text", x: -2320, y: -1500, w: 940, h: 700, seed: "a1-text" },
  { id: "a2", kind: "line", x: -2320, y: -764, w: 940, h: 600, seed: "a2-line" },
  { id: "a3", kind: "pie", x: -2320, y: -128, w: 940, h: 760, seed: "a3-pie" },
  { id: "a4", kind: "valueRows", x: -2320, y: 668, w: 940, h: 832, seed: "a4-vr" },

  // Column B
  { id: "b1", kind: "valueRows", x: -1344, y: -1500, w: 900, h: 560, seed: "b1-vr" },
  { id: "b2", kind: "bar", x: -1344, y: -904, w: 900, h: 700, seed: "b2-bar" },
  { id: "b3", kind: "text", x: -1344, y: -168, w: 900, h: 760, seed: "b3-text" },
  { id: "b4", kind: "pie", x: -1344, y: 628, w: 900, h: 872, seed: "b4-pie" },

  // Column C — the centrepiece: the year counter above a 3x2 donut grid.
  { id: "c0", kind: "line", x: -408, y: -1500, w: 1572, h: 480, seed: "c0-line" },
  { id: "c1", kind: "valueRows", x: -408, y: -984, w: 1572, h: 380, seed: "c1-vr" },
  { id: "yc", kind: "counter", x: -408, y: -568, w: 760, h: 160, seed: "year" },
  { id: "d1", kind: "donut", x: -408, y: -372, w: 500, h: 520, seed: "donut-1" },
  { id: "d2", kind: "donut", x: 128, y: -372, w: 500, h: 520, seed: "donut-2" },
  { id: "d3", kind: "donut", x: 664, y: -372, w: 500, h: 520, seed: "donut-3" },
  { id: "d4", kind: "donut", x: -408, y: 184, w: 500, h: 520, seed: "donut-4" },
  { id: "d5", kind: "donut", x: 128, y: 184, w: 500, h: 520, seed: "donut-5" },
  { id: "d6", kind: "donut", x: 664, y: 184, w: 500, h: 520, seed: "donut-6" },
  { id: "c2", kind: "text", x: -408, y: 740, w: 1572, h: 760, seed: "c2-text" },

  // Column D — off-crop at frame 0, drifts fully into view.
  { id: "e1", kind: "pie", x: 1200, y: -1500, w: 1700, h: 740, seed: "e1-pie" },
  { id: "e2", kind: "line", x: 1200, y: -724, w: 1700, h: 640, seed: "e2-line" },
  { id: "e3", kind: "bar", x: 1200, y: -48, w: 1700, h: 700, seed: "e3-bar" },
  { id: "e4", kind: "text", x: 1200, y: 688, w: 1700, h: 812, seed: "e4-text" },
];
// #endregion

// #region layout:sparse
/**
 * "sparse" — a genuinely different arrangement, not v1 scaled up. 9 panels
 * instead of 21, each far larger, with gutters wide enough that the paper
 * itself becomes an element. The 3x2 donut grid becomes a single row of three
 * large donuts, and one line chart spans most of the sheet's width.
 */
const sparse: PanelSpec[] = [
  // The counter moves to the sheet's upper-left in this mode.
  { id: "yc", kind: "counter", x: -2350, y: -1400, w: 1000, h: 200, seed: "year" },
  { id: "s9", kind: "text", x: -1150, y: -1400, w: 1500, h: 340, seed: "s9-text" },

  { id: "s1", kind: "text", x: -2350, y: -1060, w: 1000, h: 1000, seed: "s1-text" },

  // The single row of three large donuts.
  { id: "s2", kind: "donut", x: -1150, y: -1060, w: 980, h: 1000, seed: "donut-1" },
  { id: "s3", kind: "donut", x: 30, y: -1060, w: 980, h: 1000, seed: "donut-2" },
  { id: "s4", kind: "donut", x: 1210, y: -1060, w: 980, h: 1000, seed: "donut-3" },

  // The dominant element: one line chart spanning most of the sheet's width.
  { id: "s5", kind: "line", x: -2350, y: 140, w: 4300, h: 700, seed: "s5-line" },

  { id: "s6", kind: "bar", x: -2350, y: 940, w: 1180, h: 480, seed: "s6-bar" },
  { id: "s7", kind: "pie", x: -870, y: 940, w: 620, h: 480, seed: "s7-pie" },
  { id: "s8", kind: "bar", x: 450, y: 940, w: 1180, h: 480, seed: "s8-bar" },
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
