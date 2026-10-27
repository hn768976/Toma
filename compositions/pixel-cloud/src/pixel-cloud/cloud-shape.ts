// Signed distance (board units) to the classic cloud-icon silhouette.
// Negative inside, positive outside.

const circle = (x: number, y: number, cx: number, cy: number, r: number) =>
  Math.hypot(x - cx, y - cy) - r;

// Horizontal capsule forming the flat cloud base.
const capsule = (
  x: number,
  y: number,
  x0: number,
  x1: number,
  cy: number,
  r: number,
) => {
  const px = Math.min(Math.max(x, x0), x1);
  return Math.hypot(x - px, y - cy) - r;
};

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

export const CLOUD_BOUNDS = { minX: -3.3, maxX: 3.4, minY: -1.95, maxY: 2.35 };

export const cloudSdf = (x: number, y: number) => {
  let d = capsule(x, y, -2.1, 2.25, -0.9, 0.95);
  d = smin(d, circle(x, y, -1.7, -0.12, 1.02), 0.1);
  d = smin(d, circle(x, y, 0.4, 0.75, 1.48), 0.1);
  d = smin(d, circle(x, y, 2.12, -0.15, 1.02), 0.1);
  return d;
};
