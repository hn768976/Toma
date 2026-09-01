/**
 * blobPath — an irregular closed organic path.
 *
 * WHAT: Places N points around a centre at varied radii and joins them with a
 * smooth closed curve. Cells, microbes, clouds, ink spots, splats.
 *
 * WHY NOT AN ELLIPSE: an ellipse reads as geometry — the eye identifies it
 * instantly and it never looks alive. Varying the radius per point is what
 * makes a shape read as grown rather than drawn.
 *
 * WHY BEZIER SMOOTHING: joining the points with straight lines gives a polygon,
 * which reads as a gem or a crystal, not a cell. The curve here uses midpoints
 * between consecutive samples as on-curve anchors and the samples themselves as
 * control points, which guarantees C1 continuity all the way round INCLUDING
 * across the seam — a naive "close the path" leaves a visible corner where the
 * last point meets the first, and that corner is the single most common tell
 * that a blob was generated.
 *
 * PARAMETERS
 *   cx, cy      Centre.
 *   radius      Mean radius.
 *   rng         Seeded generator. Required.
 *   points      Sample count. Default 9. Fewer gives a lumpier, more angular
 *               form; more approaches a circle. Below 5 it stops closing
 *               convincingly.
 *   irregularity Radial variation as a fraction of `radius`, 0..1.
 *               Default 0.28. At 0 every sample sits at exactly `radius`, but
 *               the result is still slightly non-circular unless `angleJitter`
 *               is also 0 — unevenly spaced samples pull the smoothed curve
 *               inside the circle between them. Set BOTH to 0 for a true
 *               circle.
 *   angleJitter Angular variation as a fraction of the gap between samples.
 *               Default 0.2. Keeps lobes from being evenly spaced, which is
 *               what stops the shape reading as a flower.
 *   squash      Vertical scale, for an oval-ish blob. Default 1.
 *   rotation    Rotation of the whole form in radians. Default 0.
 *
 * RETURNS a `Path2D`, ready to fill or stroke, plus the sampled points in case
 * the caller wants to place something along the rim.
 *
 * GOTCHA: high `irregularity` (above ~0.5) with low `points` can produce a
 * self-intersecting path, which fills with holes under the nonzero rule. If you
 * need a guaranteed simple shape, keep irregularity below 0.4.
 *
 * EXAMPLE
 *   const { path } = blobPath({ cx: 300, cy: 300, radius: 120, rng });
 *   ctx.fillStyle = '#3AE0A0';
 *   ctx.fill(path);
 */
import type { Point, Rng } from '../types';

const TAU = Math.PI * 2;

export type BlobPathOptions = {
  cx: number;
  cy: number;
  radius: number;
  rng: Rng;
  points?: number;
  irregularity?: number;
  angleJitter?: number;
  squash?: number;
  rotation?: number;
};

export type BlobPathResult = {
  path: Path2D;
  points: Point[];
};

export const blobPath = ({
  cx,
  cy,
  radius,
  rng,
  points = 9,
  irregularity = 0.28,
  angleJitter = 0.2,
  squash = 1,
  rotation = 0,
}: BlobPathOptions): BlobPathResult => {
  const n = Math.max(3, Math.floor(points));
  const slot = TAU / n;

  const samples: Point[] = [];
  for (let i = 0; i < n; i++) {
    // Both draws always happen, so tuning one parameter does not resequence
    // the generator and reshape the entire blob.
    const rDraw = rng() * 2 - 1;
    const aDraw = rng() * 2 - 1;

    const angle = rotation + i * slot + aDraw * angleJitter * slot;
    const r = radius * (1 + rDraw * irregularity);
    samples.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r * squash,
    });
  }

  const path = new Path2D();
  const mid = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  // Start at the midpoint of the seam edge. Using midpoints as anchors and the
  // samples as control points makes every join — including the closing one —
  // smooth by construction.
  const first = mid(samples[n - 1], samples[0]);
  path.moveTo(first.x, first.y);
  for (let i = 0; i < n; i++) {
    const control = samples[i];
    const next = mid(samples[i], samples[(i + 1) % n]);
    path.quadraticCurveTo(control.x, control.y, next.x, next.y);
  }
  path.closePath();

  return { path, points: samples };
};
