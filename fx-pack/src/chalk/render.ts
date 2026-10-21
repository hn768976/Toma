/**
 * Chalk rendering: perfect-freehand outlines (thicker at both ends of each
 * stroke, with ragged edges), filled white and masked by a fixed grain texture
 * that breaks the edges and leaves tiny gaps.
 */
import { getStroke } from "perfect-freehand";
import { mulberry32 } from "../lib/random";
import { Pt, Stroke, strokeLength } from "./strokes";

export const CHALK = "#F2F2EE";
const GRAIN_SIZE = 768;

let grainCanvas: HTMLCanvasElement | null = null;

/** Fixed chalk grain: alpha mask tile (4K-pixel units), generated once. */
export const getGrain = () => {
  if (grainCanvas) return grainCanvas;
  const N = GRAIN_SIZE;
  const r = mulberry32(0xc4a1c);
  const lattice = (cell: number) => {
    const n = Math.ceil(N / cell);
    const v = new Float32Array(n * n);
    for (let i = 0; i < v.length; i++) v[i] = r();
    return (x: number, y: number) => {
      const fx = x / cell;
      const fy = y / cell;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const g = (ix: number, iy: number) => v[((iy % n) + n) % n * n + (((ix % n) + n) % n)];
      const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
      const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const fine = lattice(2);
  const mid = lattice(6);
  const coarse = lattice(32);
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // slight diagonal drag, like chalk dragged across board texture
      const f = fine(x + y * 0.35, y);
      const m = mid(x, y + x * 0.2);
      const k = coarse(x, y);
      let a = 0.5 * f + 0.35 * m + 0.15 * k;
      a = (a - 0.24) * 2.8;
      a = Math.max(0, Math.min(1, a));
      a = a * a * (3 - 2 * a);
      const i = (y * N + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * (0.42 + 0.58 * a));
    }
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
};

/** First `frac` of a stroke's length. */
export const partial = (pts: Pt[], frac: number): Pt[] => {
  if (frac >= 1) return pts;
  if (frac <= 0) return [];
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = L[L.length - 1] * frac;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= target) {
      out.push(pts[i]);
      continue;
    }
    const t = (target - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    out.push([
      pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
      pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
      pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * t,
    ]);
    break;
  }
  return out;
};

/** Small seeded positional jitter (used for the 4-variant boil). */
export const jitterPts = (pts: Pt[], seed: number, amp: number): Pt[] => {
  if (amp <= 0) return pts;
  const r = mulberry32(seed);
  const ox = (r() - 0.5) * amp;
  const oy = (r() - 0.5) * amp;
  const p1 = r() * 6.28;
  return pts.map(([x, y, w], i) => [x + ox + Math.sin(i * 0.7 + p1) * amp * 0.3, y + oy, w] as Pt);
};

/** Fill one chalk stroke's outline into ctx (white). */
/** Resample so consecutive points are at most `step` apart (keeps streamline from cutting corners). */
const densify = (pts: Pt[], step: number): Pt[] => {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
};

export const fillStroke = (ctx: CanvasRenderingContext2D, raw: Pt[], seed: number, fullLength: number) => {
  if (raw.length === 0) return;
  const avgW = raw.reduce((s, p) => s + p[2], 0) / raw.length;
  const pts = raw.length > 1 ? densify(raw, Math.max(2, avgW * 0.5)) : raw;
  // thicker at both ends of the full stroke: pressure bump near start and end
  let run = 0;
  const input = pts.map((p, i) => {
    if (i > 0) run += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const fromEnd = fullLength - run;
    const bump = 0.22 * (Math.exp(-run / (avgW * 2.2)) + Math.exp(-fromEnd / (avgW * 2.2)));
    return [p[0], p[1], Math.min(1, 0.42 * (p[2] / avgW) + bump)];
  });
  if (input.length === 1) input.push([input[0][0] + 0.5, input[0][1] + 0.3, input[0][2]]);
  const outline = getStroke(input, {
    size: avgW * 1.4,
    thinning: 0.45,
    smoothing: 0.55,
    streamline: 0.25,
    simulatePressure: false,
    last: true,
  });
  if (outline.length < 3) return;
  const r = mulberry32(seed);
  const amp = avgW * 0.1;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * (0.78 + 0.22 * r()); // pressure varies stroke to stroke
  ctx.beginPath();
  outline.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * amp;
    const jy = y + (r() - 0.5) * amp;
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = prevAlpha;
};

/**
 * Apply the grain mask to everything drawn so far in ctx (which must be a
 * layer holding only chalk). `scale` maps 4K px to backing px, `shift` moves
 * the grain (boil variants).
 */
export const applyGrain = (ctx: CanvasRenderingContext2D, scale: number, shift: [number, number] = [0, 0]) => {
  const pat = ctx.createPattern(getGrain(), "repeat")!;
  pat.setTransform(new DOMMatrix([scale, 0, 0, scale, shift[0] * scale, shift[1] * scale]));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
};

export const lengths = (strokes: Stroke[]) => strokes.map(strokeLength);
