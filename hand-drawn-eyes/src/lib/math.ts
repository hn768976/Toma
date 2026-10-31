export type Pt = [number, number];

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const mod = (a: number, n: number) => ((a % n) + n) % n;

// Sum of a few seeded sines: a smooth closed "wobble" over t in [0,1).
export type Wobble = { amp: number; freq: number; phase: number }[];
export const evalWobble = (w: Wobble, t: number) =>
  w.reduce((s, h) => s + h.amp * Math.sin(TAU * h.freq * t + h.phase), 0);

// Resample a polyline to n points evenly spaced by arc length.
export const resample = (pts: Pt[], n: number, closed = false): Pt[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const lens = [0];
  for (let i = 1; i < src.length; i++) {
    lens.push(
      lens[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]),
    );
  }
  const total = lens[lens.length - 1];
  const out: Pt[] = [];
  const count = closed ? n : n - 1;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (total * i) / count;
    while (j < lens.length - 2 && lens[j + 1] < d) j++;
    const seg = lens[j + 1] - lens[j] || 1;
    const t = (d - lens[j]) / seg;
    out.push([
      lerp(src[j][0], src[j + 1][0], t),
      lerp(src[j][1], src[j + 1][1], t),
    ]);
  }
  return out;
};

export const polyPath = (pts: Pt[], close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  if (close) p.closePath();
  return p;
};
