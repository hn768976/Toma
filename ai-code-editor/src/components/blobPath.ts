import { BLOB_CYCLE } from "../layout";

const TAU = Math.PI * 2;
const SAMPLES = 72;

/**
 * Seeded, frame-keyed noise: a sum of integer harmonics in theta (so the curve
 * always closes) whose phases advance by whole turns over BLOB_CYCLE frames (so
 * the morph loops exactly). Amplitudes sum to 0.27, well under 1, which keeps
 * the radius positive and the shape star-convex — it can never self-intersect.
 */
const radiusAt = (theta: number, t: number): number =>
  1 +
  0.115 * Math.sin(2 * theta + TAU * t + 0.7) +
  0.075 * Math.sin(3 * theta - TAU * 2 * t + 2.1) +
  0.05 * Math.sin(5 * theta + TAU * t + 4.2) +
  0.03 * Math.sin(7 * theta - TAU * 3 * t + 1.3);

type Point = [number, number];

/** Closed Catmull-Rom spline, emitted as cubic beziers. */
const closedSpline = (pts: Point[]): string => {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  let d = `M ${at(0)[0].toFixed(2)} ${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d +=
      ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}` +
      ` ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}` +
      ` ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
};

export const blobPath = (
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): string => {
  const t = (frame % BLOB_CYCLE) / BLOB_CYCLE;
  const pts: Point[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * TAU;
    const k = radiusAt(theta, t);
    pts.push([cx + Math.cos(theta) * rx * k, cy + Math.sin(theta) * ry * k]);
  }
  return closedSpline(pts);
};
