/**
 * Conic page curl, computed analytically and rendered in 2D.
 *
 * Geometry
 * --------
 * Work in page space: the origin is the peeled corner (top-left), `d` is the
 * unit peel direction (down the diagonal) and `n` is the unit vector along the
 * fold line. Any page point has coordinates (s, v) = (p·d, p·n).
 *
 * The sheet runs flat for s >= t, then wraps a cylinder of radius R whose axis
 * lies on the fold line. Travelling `u = t - s` of paper from the fold turns
 * the sheet through `alpha = u / R`:
 *
 *   s'(alpha) = t - R sin(alpha)      z(alpha) = R (1 - cos(alpha))
 *
 * so the roll bulges back over the peeled side, and past a half turn the sheet
 * leaves the cylinder and lies flat at height 2R over the page it came from:
 *
 *   s'(u > pi R) = 2t - pi R - s      (the flap, mirrored about the fold)
 *
 * Making R a function of v — small at one end of the fold line, larger at the
 * other — turns the cylinder into the cone that a real corner peel forms.
 *
 * All three branches invert in closed form, which is what makes a per-pixel
 * warp cheap enough to run at 4K.
 */

export type Curl = {
  /** Unit peel direction in page space. */
  dx: number;
  dy: number;
  /** Unit vector along the fold line (d rotated a quarter turn). */
  nx: number;
  ny: number;
  /** Distance of the fold line from the peeled corner, along d. */
  t: number;
  width: number;
  height: number;
  /** Cone radius at fold-line coordinate v. */
  radiusAt: (v: number) => number;
};

/** How far the fold travels, as a multiple of the page diagonal. */
const OVERSHOOT = 1.12;
/** Largest roll radius, as a fraction of page width. */
const MAX_RADIUS = 0.4;
/**
 * Ceiling on the radius as a fraction of the peel distance. A roll can only be
 * as fat as the paper feeding it: without this the half-turn never completes,
 * the sheet stays draped over the card, and the peel reads as though it has
 * barely started.
 */
const RADIUS_TO_FOLD = 0.24;
/** Radius at the tight end of the cone, relative to the wide end. */
const CONE_MIN = 0.14;
/** Radius never reaches zero — it would divide by zero and read as a crease. */
const RADIUS_FLOOR = 0.004;

/** Roll radius over the flip: nothing at either end, fullest in the middle. */
const radiusEnvelope = (progress: number) =>
  Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, progress))), 0.55);

export const makeCurl = (
  width: number,
  height: number,
  progress: number,
): Curl => {
  const diagonal = Math.hypot(width, height);
  const dx = width / diagonal;
  const dy = height / diagonal;
  // n = d rotated 90 degrees; +v points towards the bottom-left corner.
  const nx = -dy;
  const ny = dx;

  // The fold-line coordinates of the two off-diagonal corners bracket the cone:
  // the apex sits at the bottom-left end, and the radius opens up towards the
  // top-right, which is the way a corner peel actually rolls.
  const vApex = height * dx;
  const vWide = -width * dy;
  const vSpan = vApex - vWide;

  const base = Math.min(
    MAX_RADIUS * width * radiusEnvelope(progress),
    RADIUS_TO_FOLD * diagonal * OVERSHOOT * progress,
  );
  const floor = RADIUS_FLOOR * width;

  const radiusAt = (v: number) => {
    const along = (vApex - v) / vSpan;
    const clamped = along < 0 ? 0 : along > 1 ? 1 : along;
    return Math.max(floor, base * (CONE_MIN + (1 - CONE_MIN) * clamped));
  };

  return {
    dx,
    dy,
    nx,
    ny,
    t: diagonal * OVERSHOOT * progress,
    width,
    height,
    radiusAt,
  };
};

/** Page point for the (s, v) pair, in page space. */
export const toPage = (
  curl: Curl,
  s: number,
  v: number,
): {x: number; y: number} => ({
  x: s * curl.dx + v * curl.nx,
  y: s * curl.dy + v * curl.ny,
});

/**
 * Signed distance from a page-space point to the page rectangle: negative
 * inside, positive outside. Used both to antialias the flap's silhouette and
 * to give its cast shadow a soft edge.
 */
export const pageDistance = (
  x: number,
  y: number,
  width: number,
  height: number,
): number => {
  const ex = Math.max(-x, x - width);
  const ey = Math.max(-y, y - height);
  const outside = Math.hypot(Math.max(ex, 0), Math.max(ey, 0));
  return outside + Math.min(Math.max(ex, ey), 0);
};

/** Corners of the free flap in page space — enough to bound the dirty region. */
export const flapCorners = (curl: Curl): {x: number; y: number}[] => {
  const {width: w, height: h, dx, dy, nx, ny, t} = curl;
  return [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => {
    const s = x * dx + y * dy;
    const v = x * nx + y * ny;
    const mirrored = 2 * t - Math.PI * curl.radiusAt(v) - s;
    return {
      x: mirrored * dx + v * nx,
      y: mirrored * dy + v * ny,
    };
  });
};
