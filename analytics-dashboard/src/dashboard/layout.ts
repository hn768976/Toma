/**
 * All geometry is authored in a fixed 3840x2160 DESIGN space. The dashboard's
 * offscreen canvas may be smaller (see `Variant.buffer`), in which case the
 * renderer applies a single uniform scale before any painter runs. Painters
 * therefore never need to know the real buffer size.
 */

export const DESIGN_WIDTH = 3840;
export const DESIGN_HEIGHT = 2160;
export const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT;

export type Rect = { x: number; y: number; w: number; h: number };

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Horizontal split: main column takes the left two-thirds. */
const MARGIN = 56;
const GUTTER = 36;
const TICKER_H = 104;
const CONTENT_TOP = TICKER_H + 32;
const CONTENT_BOTTOM = DESIGN_HEIGHT - MARGIN;

const MAIN_X = MARGIN;
const MAIN_W = 2472;
const RIGHT_X = MAIN_X + MAIN_W + GUTTER;
const RIGHT_W = DESIGN_WIDTH - MARGIN - RIGHT_X;

const CHART_H = 1256;
const COUNTER_TOP = CONTENT_TOP + CHART_H + GUTTER;

/** Right column stack. */
const DONUT_H = 820;
const SIDE_H = 336;
const SIDE_A_Y = CONTENT_TOP + DONUT_H + GUTTER;
const SIDE_B_Y = SIDE_A_Y + SIDE_H + GUTTER;
const MAP_Y = SIDE_B_Y + SIDE_H + GUTTER;

export const LAYOUT = {
  margin: MARGIN,
  gutter: GUTTER,

  /** Full-width scrolling strip across the top. */
  ticker: rect(0, 0, DESIGN_WIDTH, TICKER_H),

  /** Left two-thirds: the line chart. */
  chart: rect(MAIN_X, CONTENT_TOP, MAIN_W, CHART_H),
  /** Legend row inside the chart panel, above the plot. */
  chartLegend: rect(MAIN_X + 60, CONTENT_TOP + 34, MAIN_W - 120, 68),
  /** The plot area proper: everything inside the axes. */
  plot: rect(MAIN_X + 186, CONTENT_TOP + 140, MAIN_W - 186 - 62, CHART_H - 140 - 118),

  /** Counter row beneath the chart, same width as the chart panel. */
  counterRow: rect(MAIN_X, COUNTER_TOP, MAIN_W, CONTENT_BOTTOM - COUNTER_TOP),

  /** Right column, top to bottom. */
  donut: rect(RIGHT_X, CONTENT_TOP, RIGHT_W, DONUT_H),
  sideA: rect(RIGHT_X, SIDE_A_Y, RIGHT_W, SIDE_H),
  sideB: rect(RIGHT_X, SIDE_B_Y, RIGHT_W, SIDE_H),
  map: rect(RIGHT_X, MAP_Y, RIGHT_W, CONTENT_BOTTOM - MAP_Y),
} as const;

/** Five evenly spaced counter cells inside `LAYOUT.counterRow`. */
export const COUNTER_CELLS: Rect[] = (() => {
  const count = 5;
  const gap = 30;
  const row = LAYOUT.counterRow;
  const w = (row.w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => rect(row.x + i * (w + gap), row.y, w, row.h));
})();

/** Panel corner radius, in design units. */
export const PANEL_RADIUS = 14;
