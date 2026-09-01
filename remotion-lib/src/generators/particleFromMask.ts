/**
 * particleFromMask.ts — scatter particles inside a silhouette.
 *
 * WHAT IT DOES
 *   Rejection-samples points inside an arbitrary filled shape, optionally
 *   weighting density toward the shape's edge, and returns them with a
 *   normalised edge-distance per particle.
 *
 * WHAT IT IS FOR
 *   Every "made of particles" figure: a head or body dissolving into
 *   dust, a logo assembling from motes, a cloud, a map, a piece of text
 *   rendered as a swarm. The silhouette carries the recognition; the
 *   particles carry the motion.
 *
 * WHY REJECTION SAMPLING
 *   The alternative is scan-converting the shape into a list of interior
 *   cells and picking from it, which needs the whole shape resident as a
 *   grid and returns points snapped to that grid. Rejection sampling
 *   needs only an inside-test, works at any density, and returns
 *   continuous positions — so particles do not sit on a visible lattice.
 *   The cost is that thin shapes reject a lot; see the gotcha.
 *
 * WHY EDGE WEIGHTING
 *   Uniform density inside a silhouette reads as a flat blob: the eye
 *   gets no contour, because the only information about the shape is at
 *   the boundary and that boundary has exactly the same particle density
 *   as the middle. Biasing density toward the edge draws the contour in
 *   particles, which is what makes the figure legible while still
 *   dissolving.
 *
 * PARAMETERS
 *   count        how many particles to return
 *   mask         inside-test: `(x, y) => boolean`. Build one from a
 *                canvas with maskFromImageData below, or write your own
 *                for an analytic shape.
 *   bounds       { x, y, width, height } region to sample within. Sample
 *                the shape's bounding box, not the whole frame — the
 *                rejection rate is the ratio of the two.
 *   seed         integer; same seed => same scatter
 *   edgeWeight   0..1. 0 = uniform interior density. 1 = strongly
 *                concentrated at the boundary. Default 0.45.
 *   edgeRadius   px within which a point counts as "near the edge".
 *                Default 12. Roughly the thickness of the bright rim.
 *   maxAttempts  safety bound on total draws. Default count * 200.
 *
 * RETURNS
 *   MaskParticle[] with x, y, and `edgeDistance` (0 at the boundary, 1 at
 *   edgeRadius or deeper) — use it to drive size, alpha or colour so the
 *   rim reads brighter than the interior.
 *
 * GOTCHA
 *   Cost scales with how much of `bounds` the shape does NOT fill. A thin
 *   diagonal stroke inside a large box can reject 95%+ of draws. If you
 *   hit maxAttempts you get fewer particles than you asked for — the
 *   function returns what it found rather than looping forever. Tighten
 *   `bounds` first; that is almost always the fix.
 *
 * GOTCHA 2
 *   Call this ONCE, not per frame. The particle set is the figure's
 *   identity; regenerating it every frame makes it boil. Animate by
 *   moving the returned particles, not by re-sampling.
 *
 * USAGE
 *   const mask = maskFromImageData(imageData, bounds, 128);
 *   const particles = useMemo(
 *     () => particleFromMask({ count: 4000, mask, bounds, seed: 4 }),
 *     [mask, bounds],
 *   );
 */

import type { Rect } from "../types";
import { makeRng } from "../random/seededRandom";

export type MaskFn = (x: number, y: number) => boolean;

export type MaskParticle = {
  x: number;
  y: number;
  /** 0 at the silhouette boundary, 1 at edgeRadius deep or further. */
  edgeDistance: number;
  index: number;
};

export type ParticleFromMaskOptions = {
  count: number;
  mask: MaskFn;
  bounds: Rect;
  seed: number;
  edgeWeight?: number;
  edgeRadius?: number;
  maxAttempts?: number;
};

/**
 * Approximates distance-to-edge by probing outward in eight directions
 * and taking the nearest miss. Cheap, and only ever called for points
 * already known to be inside.
 */
const edgeDistanceAt = (
  x: number,
  y: number,
  mask: MaskFn,
  edgeRadius: number,
): number => {
  const directions = 8;
  const steps = 4;
  let nearest = edgeRadius;

  for (let d = 0; d < directions; d++) {
    const angle = (d / directions) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let s = 1; s <= steps; s++) {
      const distance = (s / steps) * edgeRadius;
      if (!mask(x + dx * distance, y + dy * distance)) {
        if (distance < nearest) nearest = distance;
        break;
      }
    }
  }
  return nearest / edgeRadius;
};

export const particleFromMask = ({
  count,
  mask,
  bounds,
  seed,
  edgeWeight = 0.45,
  edgeRadius = 12,
  maxAttempts,
}: ParticleFromMaskOptions): MaskParticle[] => {
  const rng = makeRng(seed);
  const attemptLimit = maxAttempts ?? count * 200;
  const particles: MaskParticle[] = [];

  let attempts = 0;
  while (particles.length < count && attempts < attemptLimit) {
    attempts++;
    const x = bounds.x + rng() * bounds.width;
    const y = bounds.y + rng() * bounds.height;
    if (!mask(x, y)) continue;

    const edgeDistance = edgeDistanceAt(x, y, mask, edgeRadius);

    if (edgeWeight > 0) {
      // Acceptance falls off with depth into the shape. At edgeWeight 1 an
      // interior point is accepted rarely; at 0 the test is skipped.
      const acceptance = 1 - edgeWeight * edgeDistance;
      if (rng() > acceptance) continue;
    }

    particles.push({
      index: particles.length,
      x,
      y,
      edgeDistance,
    });
  }

  return particles;
};

/**
 * Builds a MaskFn from pixel data — the usual way to get a silhouette
 * from rendered text, an SVG, or a PNG. `threshold` is the alpha value
 * (0-255) above which a pixel counts as inside; 128 is a sensible cut.
 *
 * `bounds` must describe the region the ImageData covers, so composition
 * coordinates map onto the right pixels.
 */
export const maskFromImageData = (
  image: ImageData,
  bounds: Rect,
  threshold = 128,
): MaskFn => {
  const { width, height, data } = image;
  return (x, y) => {
    const px = Math.floor(((x - bounds.x) / bounds.width) * width);
    const py = Math.floor(((y - bounds.y) / bounds.height) * height);
    if (px < 0 || px >= width || py < 0 || py >= height) return false;
    return data[(py * width + px) * 4 + 3] > threshold;
  };
};

/**
 * Renders a draw callback into an offscreen canvas and returns a MaskFn
 * over its alpha. The convenient path when the silhouette is something
 * you can draw — text, a path, a logo.
 */
export const maskFromDraw = (
  draw: (ctx: CanvasRenderingContext2D) => void,
  bounds: Rect,
  {
    resolution = 1,
    threshold = 128,
  }: { resolution?: number; threshold?: number } = {},
): MaskFn | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.width * resolution));
  canvas.height = Math.max(1, Math.ceil(bounds.height * resolution));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Draw in composition coordinates, offset so bounds.x/y maps to 0,0.
  ctx.scale(resolution, resolution);
  ctx.translate(-bounds.x, -bounds.y);
  draw(ctx);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return maskFromImageData(image, bounds, threshold);
};
