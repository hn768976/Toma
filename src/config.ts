/**
 * Shot constants for the CandleChart composition.
 *
 * Two coordinate systems are in play:
 *
 *   screen  – the 3840x2160 canvas backing store.
 *   board   – the flat "terminal screen" we lay content out on. A single
 *             affine matrix maps board -> screen, which is what fakes the
 *             off-axis camera. Parallel lines stay parallel; at this blur
 *             level nobody can tell it isn't true projection.
 *
 * Board coordinates are unintuitive once the board is tilted, so anything that
 * has to land at a particular spot in the final frame is authored in screen
 * space and pushed back through `boardFromScreen` / `boardAt`.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;
export const DURATION = 1000;

// ── Palette ────────────────────────────────────────────────────────────────
export const COL = {
  green: "#21D191",
  red: "#E8453C",
  grid: "#1E2C3E",
  dashed: "#3A4A5E",
  substrate: "#060A10",
  cell: "#E8EEF5",
  chrome: "#7E93A8",
  digits: "#8FA0B4",
} as const;

// ── Camera ─────────────────────────────────────────────────────────────────
/**
 * Board rotation, measured off the reference rather than assumed.
 *
 * Two independent features give the same answer: the dashed price marker runs
 * at dy/dx = +0.251 (so the chart's horizontals *descend* to the right at
 * 14.1°), and the chart panel's right edge runs at dx/dy = -0.250 (so its
 * verticals lean top-right at 14.0°). Positive here is clockwise, because
 * canvas y points down.
 *
 * The brief called for -8°, i.e. the other way. The reference disagrees, and
 * with the board tilted this way the ladder becomes the diagonal running from
 * lower-left to upper-right that the brief describes as the shot's signature
 * line — which only works under a clockwise rotation.
 */
export const ROT = (14 * Math.PI) / 180;
/**
 * Horizontal shear. Zero: the horizontal and vertical angles above agree to
 * within 0.1°, which is what a pure rotation gives. Any real shear would drive
 * them apart. The ladder's extra 1.7° of lean is its own, not the board's.
 */
export const SKEW = 0;
/** Slight horizontal compression, consistent with viewing the panel off-axis. */
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

/** As `boardFromScreen`, but taking screen position as a fraction of the frame. */
export const boardAt = (fx: number, fy: number): [number, number] =>
  boardFromScreen(fx * WIDTH, fy * HEIGHT);

// ── Chart panel (board space) ──────────────────────────────────────────────
/**
 * Panel bounds. Left, top and bottom sit well off-frame; only the right edge
 * is ever seen, and it lands just inside the ladder, as in the reference.
 */
export const CHART_L = -700;
export const CHART_T = -700;
export const CHART_B = 2950;
export const CHART_R = Math.round(boardAt(0.508, 0.5)[0]);
/** Vertical band the full price range maps into. */
export const PRICE_T = 200;
export const PRICE_B = 2450;
/**
 * Vertical zoom on top of that fit. Above 1 the extremes of the walk run off
 * the top and bottom of frame, which is what keeps the visible window — under
 * half the series at a time — filling the shot instead of hugging the middle.
 */
export const PRICE_ZOOM = 1.3;
/**
 * How hard the price axis follows the trend, 0 = fixed scale, 1 = the window
 * is always dead-centred. Partial follow keeps a sense of the walk moving up
 * and down the screen while stopping it from leaving frame.
 */
export const PRICE_FOLLOW = 0.87;

// ── Candles ────────────────────────────────────────────────────────────────
// Measured off the reference: bodies run ~34px with ~12px between them, and
// the outlines are ~4px.
export const BODY_W = 34;
export const GAP = 12;
export const PITCH = BODY_W + GAP;
export const WICK_W = 4;
export const STROKE_W = 4;

/**
 * Candle count.
 *
 * The loop closes by scrolling exactly one series width across DURATION
 * frames, so frames-per-candle is pinned to DURATION / N_CANDLES. Tracking
 * the reference clip frame by frame puts its scroll at ~1.75px per frame on a
 * 768-wide encode — 219px/sec at 4K — which over a 46px pitch is 4.8 candles
 * per second. 80 candles gives 12.5 frames each, and lands on that rate.
 */
export const N_CANDLES = 80;
export const SERIES_W = N_CANDLES * PITCH;
export const FRAMES_PER_CANDLE = DURATION / N_CANDLES;

/**
 * Board x of the newest candle. The reference leaves a wide empty margin
 * between its last candle and the panel edge — the candles stop around 32% of
 * frame width while the panel runs on to about 51% — and that gap is a large
 * part of why the shot reads as calm rather than busy. It also puts the
 * forming candle inside the focal band, where it can actually be seen.
 */
export const LIVE_X = Math.round(boardAt(0.32, 0.5)[0]);

/** Candles actually on screen — the window the price follow averages over. */
export const MEAN_WINDOW = Math.round((LIVE_X - CHART_L) / PITCH);

// ── Depth of field ─────────────────────────────────────────────────────────
// Fitted to a sharpness map of the reference: gradient energy peaks around
// 18% of frame width and holds up well top to bottom, so the vertical falloff
// is gentle and the left edge softens sooner than a symmetric fit would give.
const FOCUS = boardAt(0.18, 0.5);
export const FOCUS_X = Math.round(FOCUS[0]);
export const FOCUS_Y = Math.round(FOCUS[1]);
export const FALLOFF_RIGHT = 2250;
export const FALLOFF_LEFT = 1400;
export const FALLOFF_V = 2600;
export const MAX_BLUR = 26;

// ── Order-book ladder ──────────────────────────────────────────────────────
/**
 * Counted off the reference: about 13 cells cross the frame, spaced ~165px
 * apart at 4K. At 28 the chain fuses into one bright stripe under this much
 * blur instead of reading as separate blocks.
 */
export const N_CELLS = 16;
export const CELL_H = 84;
export const CELL_W = 250;
/** The reference's cells are visibly rounded, not square. */
export const CELL_R = 14;
/**
 * The chain's signature diagonal, traced in the reference: its centre runs
 * from 59.5% of frame width at the top edge to 43.7% at the bottom — a 15.7°
 * lean, of which the board contributes 14° and the ladder itself the rest.
 * Both anchors overshoot the frame so cells cover the full height.
 */
export const LADDER_TOP_SCREEN: [number, number] = [2330, -160];
export const LADDER_BOTTOM_SCREEN: [number, number] = [1633, 2320];
/**
 * The reference's second column is not more blocks — it is a column of price
 * numbers, sitting ~330px to the right of the cells. Blurred past reading,
 * they are most of what makes that half of the frame read as a screen.
 */
export const DIGITS_OFFSET = 330;
export const N_DIGITS = 17;
