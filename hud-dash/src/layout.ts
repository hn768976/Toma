/**
 * Fixed, frontal, left-right symmetrical layout for the 3840x2160 frame.
 * Every region on the right is the mirror of its left counterpart in
 * POSITION only — what gets drawn inside differs.
 */
import { HEIGHT, WIDTH } from "./constants";

export type Rect = { x: number; y: number; w: number; h: number };

const MARGIN_X = 110;
const COL_W = 800;
const COL_TOP = 320;
const COL_BOTTOM = 2010;
const COL_GAP = 28;

/** mirror a rect across the vertical centre line */
export const mirrorRect = (r: Rect): Rect => ({
  x: WIDTH - r.x - r.w,
  y: r.y,
  w: r.w,
  h: r.h,
});

export const LAYOUT = {
  width: WIDTH,
  height: HEIGHT,
  cx: WIDTH / 2,

  rails: {
    top: { x: 0, y: 0, w: WIDTH, h: 150 } as Rect,
    bottom: { x: 0, y: HEIGHT - 150, w: WIDTH, h: 150 } as Rect,
    /** y of the rail's baseline within its own band */
    lineY: 74,
  },

  /** paired corner indicators, above each column */
  pods: {
    left: { x: MARGIN_X, y: 142, w: COL_W, h: 176 } as Rect,
  },

  columns: {
    left: { x: MARGIN_X, y: COL_TOP, w: COL_W, h: COL_BOTTOM - COL_TOP } as Rect,
    gap: COL_GAP,
  },

  centre: { cx: WIDTH / 2, cy: 1010, r: 495 },

  /** flanking ring gauges — mirrored positions, independent values */
  gauge: { cx: 1120, cy: 1010, r: 195 },

  /** three pies + two waveform strips, beneath the centre */
  pieRow: {
    cy: 1744,
    r: 92,
    xs: [1560, 1920, 2280],
    labelY: 1872,
    wave: { w: 148, h: 84 },
  },
} as const;

/** Split a column rect into n stacked panels. */
export const stack = (col: Rect, n: number, gap = COL_GAP): Rect[] => {
  const h = (col.h - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: col.x,
    y: col.y + i * (h + gap),
    w: col.w,
    h,
  }));
};
