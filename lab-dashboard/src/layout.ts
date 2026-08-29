/**
 * Every measurement in the piece, in 4K pixels. Flat, frontal, locked off —
 * there is no camera and no transform, so a rect here is exactly where the
 * thing lands on screen.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

export type Rect = { x: number; y: number; w: number; h: number };

/** Shared panel chrome metrics. */
export const BORDER_W = 2;
export const CORNER_TICK = 26;
export const STRIP_H = 34;

const CONTENT_TOP = 118;
const CONTENT_BOTTOM = 2118;

export const HEADER: Rect = { x: 0, y: 0, w: WIDTH, h: 74 };
export const HEADER_RULE_Y = 94;

/* ── Left column (~22%), deliberately cropped by the left frame edge ── */
const LEFT_X = -46;
const LEFT_W = 908;

export const THUMB_PANEL: Rect = { x: LEFT_X, y: CONTENT_TOP, w: LEFT_W, h: 944 };
export const TABLE_PANEL: Rect = { x: LEFT_X, y: 1092, w: LEFT_W, h: 918 };
export const PROGRESS_STRIP: Rect = { x: LEFT_X, y: 2038, w: LEFT_W, h: 80 };

/** The two tables stacked inside TABLE_PANEL. */
export const TABLE_SLOTS: readonly Rect[] = [
  { x: LEFT_X + 16, y: 1092 + STRIP_H + 18, w: LEFT_W - 32, h: 400 },
  { x: LEFT_X + 16, y: 1092 + STRIP_H + 448, w: LEFT_W - 32, h: 400 },
];

/* ── Centre (~48%): the three waveform panels, the subject ── */
const CENTRE_X = 882;
const CENTRE_W = 1846;
const WAVE_H = 508;
const WAVE_GAP = 30;

export const WAVE_PANELS: readonly Rect[] = [0, 1, 2].map((i) => ({
  x: CENTRE_X,
  y: CONTENT_TOP + i * (WAVE_H + WAVE_GAP),
  w: CENTRE_W,
  h: WAVE_H,
}));

/* ── Right of centre (~12%): one readout block per waveform panel ── */
const READOUT_X = 2764;
const READOUT_W = 462;

export const READOUT_BLOCKS: readonly Rect[] = WAVE_PANELS.map((p) => ({
  x: READOUT_X,
  y: p.y,
  w: READOUT_W,
  h: p.h,
}));

/* ── Bottom centre: cell matrix + spectrum trace ── */
const BOTTOM_Y = 1732;
const BOTTOM_H = CONTENT_BOTTOM - BOTTOM_Y;

export const CELL_MATRIX: Rect = { x: CENTRE_X, y: BOTTOM_Y, w: 806, h: BOTTOM_H };
export const SPECTRUM: Rect = { x: 1718, y: BOTTOM_Y, w: 1010, h: BOTTOM_H };

/* ── Far right (~16%), running off the right edge of the frame ── */
const FAR_X = 3252;
const FAR_W = 660;
const FAR_H = 477;
const FAR_GAP = 30;

export const INDICATOR_PANELS: readonly Rect[] = [0, 1, 2, 3].map((i) => ({
  x: FAR_X,
  y: CONTENT_TOP + i * (FAR_H + FAR_GAP),
  w: FAR_W,
  h: FAR_H,
}));

/* ── Type sizes ── */
export const FONT = {
  header: 30,
  strip: 20,
  waveId: 62,
  axisTick: 26,
  readoutValue: 152,
  readoutUnit: 104,
  readoutNote: 30,
  tableTitle: 22,
  tableHead: 18,
  tableCell: 17,
  thumb: 17,
  tiny: 15,
  indicator: 20,
} as const;

/** Inner plot area of a waveform panel, below its top label strip. */
export const wavePlot = (p: Rect): Rect => ({
  x: p.x + 6,
  y: p.y + STRIP_H + 4,
  w: p.w - 12,
  h: p.h - STRIP_H - 10,
});
