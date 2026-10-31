import { getStroke, type StrokeOptions } from "perfect-freehand";
import type { Pt } from "./math";

// perfect-freehand outline -> Path2D (smoothed with quadratic midpoints).
export const outlineToPath = (outline: number[][]) => {
  const p = new Path2D();
  const n = outline.length;
  if (n < 3) return p;
  p.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  p.closePath();
  return p;
};

// A pressure-shaped stroke through the given points. `pressures` (0..1)
// are per point; when omitted, perfect-freehand simulates pressure.
export const freehand = (
  pts: Pt[],
  opts: StrokeOptions & { pressures?: number[] },
) => {
  const { pressures, ...o } = opts;
  const input = pts.map(([x, y], i) =>
    pressures ? [x, y, pressures[i]] : [x, y],
  );
  return outlineToPath(
    getStroke(input, {
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.35,
      simulatePressure: !pressures,
      last: true,
      ...o,
    }),
  );
};
