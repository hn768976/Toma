// Closed polygon with every corner rounded to radius r.
export const roundedPolygon = (
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  r: number,
) => {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const c = pts[i];
    const next = pts[(i + 1) % n];
    ctx.arcTo(c[0], c[1], next[0], next[1], r);
  }
  ctx.closePath();
};

// Opaque colour at a fraction k of its brightness (k = 1 is the colour itself).
// Used instead of translucency on green: a translucent element is a mix with
// the key green, which a chroma key either removes or leaves green-tinted.
export const dim = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
