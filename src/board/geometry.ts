import {
  BOARD_W_BASE,
  COL_FRAC,
  COL_CHARS,
  COL_FONT,
  COL_RECEDE,
  COL_TRIM,
  FRAME_SAFE,
  FRAME_SHIFT,
  FOCUS_X,
  FOCUS_X_WEIGHT,
  FOCUS_Y_CORE,
  FOCUS_Y_FALLOFF,
  FOCUS_Y_WEIGHT,
  HEIGHT,
  MONO_ADVANCE,
  PLANE_DIST,
  RULE_CONVERGE_DEG,
  SHEAR,
  TILT_DEG,
  WIDTH,
} from './constants';

/** A 2D affine matrix in canvas order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

export const matMul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const matApplyX = (m: Mat, x: number, y: number) => m[0] * x + m[2] * y + m[4];
export const matApplyY = (m: Mat, x: number, y: number) => m[1] * x + m[3] * y + m[5];

const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const rotate = (rad: number): Mat => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};
const shearX = (k: number): Mat => [1, 0, k, 1, 0, 0];
const scale = (s: number): Mat => [s, 0, 0, s, 0, 0];

const PIVOT_X = WIDTH / 2;
const PIVOT_Y = HEIGHT / 2;

/**
 * The whole camera, as one affine transform: a few degrees of counter-clockwise
 * tilt plus a horizontal shear, both about the frame centre.
 *
 * This is deliberately not a real projection. Parallel lines stay parallel;
 * at this blur level the difference is invisible, and the per-column recede
 * and the per-rule convergence supply the rest of the depth cue.
 */
export const BOARD_MAT: Mat = [
  translate(PIVOT_X, PIVOT_Y),
  rotate((TILT_DEG * Math.PI) / 180),
  shearX(SHEAR),
  translate(-PIVOT_X, -PIVOT_Y),
].reduce(matMul);

/** The same transform, pre-scaled for an offscreen plane rendered at `s`. */
export const planeMat = (s: number): Mat => matMul(scale(s), BOARD_MAT);

// ── Column layout ──────────────────────────────────────────────────────────

/** Width of each column after the recede, in board units. */
export const COL_W = COL_FRAC.map((f, i) => f * BOARD_W_BASE * COL_RECEDE[i]);

const BOARD_W = COL_W.reduce((a, b) => a + b, 0);
const BOARD_X0 = (WIDTH - BOARD_W) / 2;

/** Left edge of each column, in board units. */
export const COL_X = COL_W.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? BOARD_X0 : acc[i - 1] + COL_W[i - 1]);
  return acc;
}, []);

/** Right edge of each column. */
export const COL_X_END = COL_X.map((x, i) => x + COL_W[i]);

/** Width of a column's typical numeral string, in board units. */
const BLOCK_W = COL_CHARS.map((n, i) => n * MONO_ADVANCE * COL_FONT[i]);

/**
 * Right-align anchor for each column's numerals.
 *
 * Centred in the column, then pulled inboard far enough that the outer
 * columns still read at the frame edges rather than hanging off them.
 */
export const COL_ANCHOR = COL_X.map((x, i) => {
  const centred = x + COL_W[i] / 2 + BLOCK_W[i] / 2 - COL_W[i] * COL_TRIM;
  const lo = FRAME_SAFE + BLOCK_W[i] + FRAME_SHIFT;
  const hi = WIDTH - FRAME_SAFE - FRAME_SHIFT;
  return Math.min(hi, Math.max(lo, centred));
});

/** The six vertical rules: both outer edges plus the four internal ones. */
export const RULE_X = [...COL_X, COL_X_END[COL_X_END.length - 1]];

/**
 * Horizontal offset of vertical rule `i` at board-space height `y`.
 *
 * Each rule leans slightly more than the one to its left, so the verticals
 * converge a couple of degrees toward the upper right rather than staying
 * mechanically parallel to each other.
 */
const RULE_SLOPE = RULE_X.map((_, i) =>
  Math.tan((((i - (RULE_X.length - 1) / 2) * RULE_CONVERGE_DEG) * Math.PI) / 180),
);

export const ruleXAt = (i: number, y: number) =>
  RULE_X[i] + RULE_SLOPE[i] * (y - HEIGHT / 2);

// ── Depth of field ─────────────────────────────────────────────────────────

const FX = FOCUS_X * WIDTH;
const FY_CORE = FOCUS_Y_CORE * HEIGHT;
const FY_FALL = FOCUS_Y_FALLOFF * HEIGHT;

/**
 * Focus distance of a point, in *frame* coordinates, on a 0..1 axis.
 *
 * Zero across columns 1–2 and through the vertical middle of the frame;
 * rising toward the right side and toward the top and bottom edges.
 */
export const focusDist = (x: number, y: number) => {
  const h = Math.min(1, Math.max(0, (x - FX) / (WIDTH - FX))) * FOCUS_X_WEIGHT;
  const v =
    Math.min(1, Math.max(0, (Math.abs(y - HEIGHT / 2) - FY_CORE) / FY_FALL)) *
    FOCUS_Y_WEIGHT;
  return Math.min(1, Math.hypot(h, v));
};

/**
 * Split a focus distance across the three planes.
 *
 * A cell is drawn into the two planes that bracket its distance, with linear
 * weights. That interpolates between blur radii instead of snapping to one of
 * three, which is what stops the buckets from banding — and it still only ever
 * costs three blurs per frame.
 */
export const planeWeights = (dist: number, out: [number, number, number]) => {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  if (dist <= PLANE_DIST[1]) {
    const t = (dist - PLANE_DIST[0]) / (PLANE_DIST[1] - PLANE_DIST[0]);
    out[0] = 1 - t;
    out[1] = t;
  } else {
    const t = (dist - PLANE_DIST[1]) / (PLANE_DIST[2] - PLANE_DIST[1]);
    out[1] = 1 - t;
    out[2] = t;
  }
  return out;
};
