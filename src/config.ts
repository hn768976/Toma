/**
 * Shot constants for the CandleChart composition.
 *
 * Two coordinate systems are in play:
 *
 *   screen  – the 3840x2160 canvas backing store.
 *   board   – the flat "terminal screen" we lay content out on. A single
 *             affine matrix (rotate + shear) maps board -> screen, which is
 *             what fakes the off-axis camera. Parallel lines stay parallel;
 *             at this blur level nobody can tell it isn't true projection.
 *
 * Anything that needs to land at a specific spot in the final frame is
 * authored in screen space and pushed back through `boardFromScreen`.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;
export const DURATION = 1000;

// ── Palette ────────────────────────────────────────────────────────────────
export const COL = {
  green: "#21D191",
  red: "#E8453C",
  grid: "#16202E",
  dashed: "#3A4A5E",
  substrate: "#060A10",
  cell: "#E8EEF5",
  chrome: "#7E93A8",
} as const;

// ── Camera ─────────────────────────────────────────────────────────────────
/** Board rotation. Negative = counter-clockwise, so content runs up to the right. */
export const ROT = (-8 * Math.PI) / 180;
/** Horizontal shear. Negative leans verticals top-right, softening the rotation. */
export const SKEW = -0.06;
/** Horizontal compression, so the right side reads ~8% tighter than the left. */
export const SX = 0.94;

const cos = Math.cos(ROT);
const sin = Math.sin(ROT);

// M = T(c) . R(ROT) . [[SX, SKEW],[0, 1]] . T(-c), anchored on the frame centre.
const ma = cos * SX;
const mc = cos * SKEW - sin;
const mb = sin * SX;
const md = sin * SKEW + cos;
const cx = WIDTH / 2;
const cy = HEIGHT / 2;
const me = cx - (ma * cx + mc * cy);
const mf = cy - (mb * cx + md * cy);

/** board -> screen, in the argument order canvas `setTransform` wants. */
export const BOARD_MATRIX = [ma, mb, mc, md, me, mf] as const;

const det = ma * md - mc * mb;

/** screen -> board. Used to author layout against real frame positions. */
export const boardFromScreen = (sx: number, sy: number): [number, number] => {
  const px = sx - me;
  const py = sy - mf;
  return [(md * px - mc * py) / det, (-mb * px + ma * py) / det];
};

// ── Chart panel (board space) ──────────────────────────────────────────────
/** Panel bounds. Left/top/bottom sit off-frame; only the right edge is seen. */
export const CHART_L = -500;
export const CHART_R = 2000;
export const CHART_T = -450;
export const CHART_B = 2650;
/** Vertical band the full price range maps into. */
export const PRICE_T = 150;
export const PRICE_B = 2120;
/**
 * Vertical zoom on top of that fit. Above 1 the extremes of the walk run off
 * the top and bottom of frame, which is what keeps the visible window — only
 * a quarter of the series at a time — filling the shot instead of hugging
 * the middle.
 */
export const PRICE_ZOOM = 1.42;
/**
 * How hard the price axis follows the trend, 0 = fixed scale, 1 = the window
 * is always dead-centred. Partial follow keeps a sense of the walk moving up
 * and down the screen while stopping it from leaving frame.
 */
export const PRICE_FOLLOW = 0.78;

// ── Candles ────────────────────────────────────────────────────────────────
export const BODY_W = 26;
export const GAP = 10;
export const PITCH = BODY_W + GAP;
export const WICK_W = 3;
export const STROKE_W = 3;

/**
 * Candle count.
 *
 * The loop closes by scrolling exactly one series width across DURATION
 * frames, so frames-per-candle is pinned to DURATION / N_CANDLES. 112 gives
 * 8.93 frames per candle, matching the ~9 the shot calls for.
 */
export const N_CANDLES = 112;
/** Candles across the chart panel — the window the price follow averages over. */
export const MEAN_WINDOW = Math.round((CHART_R - CHART_L) / PITCH);
export const SERIES_W = N_CANDLES * PITCH; // 4032 board px
export const FRAMES_PER_CANDLE = DURATION / N_CANDLES;

/**
 * Board x of the newest candle. It has to sit inside the panel's right edge
 * but still clear of the ladder, or the formation — the one detail that makes
 * the chart read as live rather than as a scrolling image — is hidden.
 */
export const LIVE_X = CHART_R - 80;

// ── Depth of field ─────────────────────────────────────────────────────────
/** Focal point: the chart's mid-left, vertically centred. */
export const FOCUS_X = 780;
export const FOCUS_Y = 1080;
export const FALLOFF_RIGHT = 2250;
export const FALLOFF_LEFT = 2600;
export const FALLOFF_V = 2000;
export const MAX_BLUR = 26;

// ── Order-book ladder ──────────────────────────────────────────────────────
export const N_CELLS = 28;
export const CELL_H = 52;
export const CELL_W = 172;
/**
 * The ladder's signature diagonal. Authored in screen space — it has to run
 * from lower-left to upper-right across the whole frame — then pushed back
 * into board space so it still rides the board transform.
 */
export const LADDER_BOTTOM_SCREEN: [number, number] = [1880, 2280];
export const LADDER_TOP_SCREEN: [number, number] = [2930, -120];
