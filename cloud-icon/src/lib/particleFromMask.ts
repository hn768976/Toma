import { seededSequence } from "./random";

/**
 * Edge-weighted particle sampling against an arbitrary drawn silhouette.
 *
 * You supply a draw callback; it is rasterised once to an offscreen canvas, a
 * chamfer distance transform gives every cell its distance to the nearest
 * edge, and particles are then rejection-sampled with an acceptance
 * probability that falls off from the boundary inward. The result is dense
 * along the silhouette's edge and sparse through its middle, which is what
 * makes a particle-built shape legible.
 *
 * Nothing here knows what it is drawing — pass any closed shape.
 */

export type MaskField = {
  /** Mask grid size (source size divided by `downscale`). */
  maskWidth: number;
  maskHeight: number;
  downscale: number;
  /** Source-space dimensions the field was built for. */
  width: number;
  height: number;
  /** True when the source-space point falls inside the silhouette. */
  isInside: (x: number, y: number) => boolean;
  /** Source-space distance from (x, y) to the nearest edge, inside the shape. */
  insideDistance: (x: number, y: number) => number;
  /** Source-space distance from (x, y) to the nearest edge, outside the shape. */
  outsideDistance: (x: number, y: number) => number;
  /** Deepest interior distance found, in source-space pixels. */
  maxInsideDistance: number;
  /** Tight source-space bounding box of the silhouette. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

export type MaskParticle = {
  x: number;
  y: number;
  /** Source-space distance to the nearest silhouette edge. */
  edgeDistance: number;
  /** 0 at the edge, 1 at the deepest interior point. */
  depth: number;
  /** True for points sampled outside the silhouette. */
  outside: boolean;
};

// Chamfer weights for the 3x3 two-pass distance transform. These are the
// standard error-minimising pair, accurate to well under a percent — plenty
// for a density falloff, and far cheaper than an exact Euclidean transform.
const ORTHO = 0.95509;
const DIAG = 1.36930;

const chamferDistance = (
  binary: Uint8Array,
  w: number,
  h: number,
  /** When true, distance is measured for cells where binary is 1. */
  target: 0 | 1,
): Float32Array => {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = binary[i] === target ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let best = d[i];
      if (x > 0) best = Math.min(best, d[i - 1] + ORTHO);
      if (y > 0) best = Math.min(best, d[i - w] + ORTHO);
      if (x > 0 && y > 0) best = Math.min(best, d[i - w - 1] + DIAG);
      if (x < w - 1 && y > 0) best = Math.min(best, d[i - w + 1] + DIAG);
      d[i] = best;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let best = d[i];
      if (x < w - 1) best = Math.min(best, d[i + 1] + ORTHO);
      if (y < h - 1) best = Math.min(best, d[i + w] + ORTHO);
      if (x < w - 1 && y < h - 1) best = Math.min(best, d[i + w + 1] + DIAG);
      if (x > 0 && y < h - 1) best = Math.min(best, d[i + w - 1] + DIAG);
      d[i] = best;
    }
  }
  return d;
};

/**
 * Rasterise a silhouette and build its inside/outside distance fields.
 *
 * @param draw Receives a context already scaled so you can draw in
 *   source-space coordinates and ignore `downscale` entirely.
 */
export const buildMaskField = ({
  width,
  height,
  downscale = 4,
  draw,
}: {
  width: number;
  height: number;
  downscale?: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}): MaskField => {
  const mw = Math.max(1, Math.round(width / downscale));
  const mh = Math.max(1, Math.round(height / downscale));

  const canvas = document.createElement("canvas");
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("buildMaskField: 2d context unavailable");

  ctx.save();
  ctx.scale(1 / downscale, 1 / downscale);
  draw(ctx);
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, mw, mh).data;
  const binary = new Uint8Array(mw * mh);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      // Anything at least half-opaque counts as inside.
      if (pixels[i * 4 + 3] >= 128) {
        binary[i] = 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) throw new Error("buildMaskField: silhouette is empty");

  const inside = chamferDistance(binary, mw, mh, 1);
  const outside = chamferDistance(binary, mw, mh, 0);

  let maxInside = 0;
  for (let i = 0; i < inside.length; i++) if (inside[i] > maxInside) maxInside = inside[i];

  const cellAt = (x: number, y: number) => {
    const mx = Math.floor(x / downscale);
    const my = Math.floor(y / downscale);
    if (mx < 0 || my < 0 || mx >= mw || my >= mh) return -1;
    return my * mw + mx;
  };

  return {
    maskWidth: mw,
    maskHeight: mh,
    downscale,
    width,
    height,
    isInside: (x, y) => {
      const i = cellAt(x, y);
      return i >= 0 && binary[i] === 1;
    },
    insideDistance: (x, y) => {
      const i = cellAt(x, y);
      return i < 0 ? 0 : inside[i] * downscale;
    },
    outsideDistance: (x, y) => {
      const i = cellAt(x, y);
      return i < 0 ? Infinity : outside[i] * downscale;
    },
    maxInsideDistance: maxInside * downscale,
    bounds: {
      minX: minX * downscale,
      minY: minY * downscale,
      maxX: (maxX + 1) * downscale,
      maxY: (maxY + 1) * downscale,
    },
  };
};

/**
 * Rejection-sample particles against a mask field, weighted toward the edge.
 *
 * @param count            Total particles returned (inside + outside).
 * @param outsideFraction  Share placed beyond the silhouette, drifting free.
 * @param edgeFalloff      Source-space distance over which interior density
 *                         decays; smaller means a tighter edge band.
 * @param interiorFloor    Acceptance probability deep inside the shape, so the
 *                         middle is sparse rather than empty.
 * @param outsideBand      How far beyond the edge outliers may land.
 * @param seed             Stable string seed; the same seed always returns the
 *                         same particle set.
 */
export const particlesFromMask = ({
  field,
  count,
  outsideFraction = 0,
  edgeFalloff = 100,
  interiorFloor = 0.05,
  outsideBand = 180,
  seed,
}: {
  field: MaskField;
  count: number;
  outsideFraction?: number;
  edgeFalloff?: number;
  interiorFloor?: number;
  outsideBand?: number;
  seed: string;
}): MaskParticle[] => {
  const rng = seededSequence(seed);
  const { bounds } = field;
  const outsideCount = Math.round(count * outsideFraction);
  const insideCount = count - outsideCount;
  const particles: MaskParticle[] = [];

  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // Generous ceiling: the sampler is cheap, and bailing early would silently
  // change the particle count between builds.
  const maxAttempts = count * 4000;
  let attempts = 0;

  while (particles.length < insideCount && attempts < maxAttempts) {
    attempts++;
    const x = bounds.minX + rng.next() * spanX;
    const y = bounds.minY + rng.next() * spanY;
    if (!field.isInside(x, y)) continue;
    const d = field.insideDistance(x, y);
    const p = interiorFloor + (1 - interiorFloor) * Math.exp(-d / edgeFalloff);
    if (rng.next() > p) continue;
    particles.push({
      x,
      y,
      edgeDistance: d,
      depth: Math.min(1, d / (field.maxInsideDistance || 1)),
      outside: false,
    });
  }

  const outMinX = bounds.minX - outsideBand;
  const outMinY = bounds.minY - outsideBand;
  const outSpanX = spanX + outsideBand * 2;
  const outSpanY = spanY + outsideBand * 2;

  while (particles.length < count && attempts < maxAttempts) {
    attempts++;
    const x = outMinX + rng.next() * outSpanX;
    const y = outMinY + rng.next() * outSpanY;
    if (field.isInside(x, y)) continue;
    const d = field.outsideDistance(x, y);
    if (d > outsideBand) continue;
    // Loosely edge-hugging, but scattered enough to read as adrift.
    const p = 0.25 + 0.75 * Math.exp(-d / (outsideBand * 0.55));
    if (rng.next() > p) continue;
    particles.push({ x, y, edgeDistance: d, depth: 0, outside: true });
  }

  return particles;
};
