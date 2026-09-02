/**
 * Turning a drawn shape into a particle field.
 *
 * The technique: render an arbitrary shape once into an offscreen canvas,
 * read its pixels back, and then rejection-sample particle positions
 * against that coverage. Nothing about the shape needs to be expressible
 * as a formula — anything you can draw (a silhouette, a letterform, a
 * scribble of guide curves) becomes a sampling domain.
 *
 * Sample ONCE, in `useMemo`. Re-sampling per frame makes the field boil.
 *
 * Two extras make the result read as structure rather than dust:
 *  - `distanceField` gives every interior pixel its distance to the edge,
 *    so density can be weighted toward the outline.
 *  - `coverageField` turns a second, softly-stroked drawing (interior
 *    guide curves) into a 0..1 weight, so density can also be pulled onto
 *    features that are never themselves drawn.
 *
 * Snapping accepted positions to a grid, one particle per cell, is what
 * gives the field a quantised, digital character instead of a dust cloud.
 *
 * @example
 * const mask = renderMask(w, h, (ctx) => { ctx.fill(shapePath); });
 * const dist = distanceField(mask, true);
 * const pts = sampleFromMask({
 *   mask, count: 5000, grid: 9, seed: "brain",
 *   weightAt: (x, y, i) => 0.1 + 0.9 * Math.exp(-dist[i] / 26),
 * });
 */
import { makeRng } from "./rng";

export type Mask = {
  width: number;
  height: number;
  /** Alpha coverage 0..255, one entry per pixel, row-major. */
  alpha: Uint8Array;
};

/** Field of one float per pixel, row-major, matching a Mask's dimensions. */
export type Field = Float32Array;

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

/**
 * Draws `draw` into an offscreen canvas and reads back its alpha channel.
 * Use `willReadFrequently` off: this runs once, and the readback is the
 * whole point.
 */
export const renderMask = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Mask => {
  const ctx = makeCanvas(width, height).getContext("2d");
  if (!ctx) throw new Error("renderMask: 2d context unavailable");
  draw(ctx);
  const data = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { width, height, alpha };
};

/**
 * Same as `renderMask` but keeps the coverage as a 0..1 float field, for
 * use as a soft density weight rather than a hard inside/outside test.
 */
export const coverageField = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Field => {
  const mask = renderMask(width, height, draw);
  const field = new Float32Array(mask.alpha.length);
  for (let i = 0; i < field.length; i++) field[i] = mask.alpha[i] / 255;
  return field;
};

const INF = 1e9;

/**
 * Chamfer distance transform: distance in pixels from each pixel to the
 * nearest pixel of the opposite class.
 *
 * `inside === true`  -> distance from covered pixels to the nearest gap
 *                       (i.e. "how deep inside the shape am I").
 * `inside === false` -> distance from gaps to the nearest covered pixel
 *                       (i.e. "how far outside the shape am I").
 *
 * Two sequential passes with orthogonal/diagonal weights of 1 and sqrt(2);
 * accurate to a few percent, which is far finer than a density weight
 * needs, and linear in pixel count.
 */
export const distanceField = (mask: Mask, inside: boolean, threshold = 128): Field => {
  const { width: w, height: h, alpha } = mask;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) {
    const covered = alpha[i] >= threshold;
    d[i] = covered === inside ? INF : 0;
  }
  const D = 1;
  const G = Math.SQRT2;
  const relax = (i: number, j: number, cost: number) => {
    const v = d[j] + cost;
    if (v < d[i]) d[i] = v;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      if (x > 0) relax(i, i - 1, D);
      if (y > 0) {
        relax(i, i - w, D);
        if (x > 0) relax(i, i - w - 1, G);
        if (x < w - 1) relax(i, i - w + 1, G);
      }
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      if (x < w - 1) relax(i, i + 1, D);
      if (y < h - 1) {
        relax(i, i + w, D);
        if (x < w - 1) relax(i, i + w + 1, G);
        if (x > 0) relax(i, i + w - 1, G);
      }
    }
  }
  return d;
};

export type SampledPoint = {
  /** Grid-snapped position, in mask pixel coordinates. */
  x: number;
  y: number;
  /** The weight that accepted this point, 0..1 — useful for size/brightness. */
  weight: number;
};

export type SampleOptions = {
  mask: Mask;
  /** How many points to place. Fewer are returned if the domain saturates. */
  count: number;
  /** Cell size in pixels. Positions snap to cell centres, one point per cell. */
  grid: number;
  /** Stable string seed. */
  seed: string;
  /**
   * Acceptance probability 0..1 at a candidate position. `index` is the
   * pixel index, provided so precomputed fields can be read directly.
   * Defaults to 1 (uniform fill of the mask).
   */
  weightAt?: (x: number, y: number, index: number) => number;
  /** Coverage below this counts as outside the shape. Default 128. */
  threshold?: number;
  /** Set false to sample the gaps instead of the covered area. */
  inside?: boolean;
  /** Safety cap on rejection attempts. Default count * 60. */
  maxAttempts?: number;
  /** Restrict candidates to this sub-rectangle of the mask. */
  bounds?: { x: number; y: number; width: number; height: number };
};

/**
 * Rejection-samples `count` grid-snapped positions from a mask.
 *
 * One point per grid cell: a cell already taken is skipped, so the field
 * never stacks particles on top of each other and dense regions read as
 * an aligned lattice rather than a smear.
 */
export const sampleFromMask = (opts: SampleOptions): SampledPoint[] => {
  const { mask, count, grid, seed } = opts;
  const threshold = opts.threshold ?? 128;
  const inside = opts.inside ?? true;
  const weightAt = opts.weightAt;
  const bx = opts.bounds?.x ?? 0;
  const by = opts.bounds?.y ?? 0;
  const bw = opts.bounds?.width ?? mask.width;
  const bh = opts.bounds?.height ?? mask.height;
  const maxAttempts = opts.maxAttempts ?? count * 60;

  const rng = makeRng(seed);
  const cols = Math.ceil(mask.width / grid);
  const taken = new Set<number>();
  const out: SampledPoint[] = [];

  for (let attempt = 0; attempt < maxAttempts && out.length < count; attempt++) {
    const px = bx + rng() * bw;
    const py = by + rng() * bh;
    const gx = Math.floor(px / grid);
    const gy = Math.floor(py / grid);
    const key = gy * cols + gx;
    if (taken.has(key)) continue;

    // Test the cell centre, so the accepted point is the point that gets drawn.
    const cx = (gx + 0.5) * grid;
    const cy = (gy + 0.5) * grid;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    if (ix < 0 || iy < 0 || ix >= mask.width || iy >= mask.height) continue;
    const index = iy * mask.width + ix;
    const covered = mask.alpha[index] >= threshold;
    if (covered !== inside) continue;

    const w = weightAt ? weightAt(cx, cy, index) : 1;
    if (w <= 0) continue;
    if (w < 1 && rng() > w) continue;

    taken.add(key);
    out.push({ x: cx, y: cy, weight: Math.min(1, w) });
  }
  return out;
};

/** Tight bounding box of the covered pixels, or null if nothing is covered. */
export const maskBounds = (
  mask: Mask,
  threshold = 128,
): { x: number; y: number; width: number; height: number } | null => {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.alpha[y * mask.width + x] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};
