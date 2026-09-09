import type { Point } from "./topics";

/**
 * Catmull-Rom through the data points, emitted as cubic beziers. Gives the
 * smooth S the reference has without the overshoot a naive spline would put
 * at the flat ends.
 *
 * Points arrive normalised (x 0..1 left-to-right, y 0..1 bottom-to-top) and
 * are mapped into the pixel plot box.
 */
export const buildCurvePath = (
  data: Point[],
  box: { x: number; y: number; width: number; height: number },
): string => {
  const px = data.map((p) => ({
    x: box.x + p.x * box.width,
    // SVG y grows downward; the data's y grows upward.
    y: box.y + (1 - p.y) * box.height,
  }));

  if (px.length < 2) return "";

  let d = `M ${px[0].x.toFixed(2)} ${px[0].y.toFixed(2)}`;
  for (let i = 0; i < px.length - 1; i++) {
    const p0 = px[i - 1] ?? px[i];
    const p1 = px[i];
    const p2 = px[i + 1];
    const p3 = px[i + 2] ?? px[i + 1];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
};

/**
 * One heartbeat, as [fraction of period, amplitude] where amplitude 1 is a
 * full R spike upward. Deliberately angular — an ECG trace is drawn with
 * straight segments, and smoothing it makes it read as a generic squiggle.
 */
const BEAT: [number, number][] = [
  [0.0, 0],
  [0.1, 0],
  [0.14, 0.12],
  [0.18, 0],
  [0.3, 0],
  [0.33, -0.1],
  [0.36, 1.0],
  [0.39, -0.32],
  [0.42, 0],
  [0.55, 0],
  [0.6, 0.22],
  [0.66, 0],
  [1.0, 0],
];

/**
 * A run of `beats` heartbeats starting at x = 0. The caller translates the
 * whole path to scroll it; drawing a couple of extra periods either side is
 * what keeps the scroll seamless.
 */
export const buildEcgPath = (
  beats: number,
  period: number,
  centreY: number,
  amplitude: number,
): string => {
  const seg: string[] = [];
  for (let b = 0; b < beats; b++) {
    const originX = b * period;
    for (const [t, a] of BEAT) {
      const x = originX + t * period;
      const y = centreY - a * amplitude;
      seg.push(
        `${seg.length === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
      );
    }
  }
  return seg.join(" ");
};
