// Monotone cubic (Fritsch–Carlson) keyframe interpolation: smooth like a
// spline, but never overshoots between keys, so radii never go negative and
// motion never "rubber-bands".
export type Key = readonly [number, number];

export const track = (keys: readonly Key[]) => {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
      const w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  m[0] = n > 1 ? d[0] : 0;
  m[n - 1] = n > 1 ? d[n - 2] : 0;
  // flat ends read more natural for eased motion
  m[0] = 0;
  m[n - 1] = 0;

  return (x: number): number => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
};
