import { outline, Pt, Stroke, toPath2D } from "./geom";
import { Layer, scratch } from "./layer";
import { edgeNoise, EdgeName, TextureName, TILE } from "./textures";

type Grain = { edge: EdgeName; reach: number; core: TextureName; tone: string };

// `reach`: how far the edge wanders, as a fraction of stroke width.
// `tone`: the colour the core grain paints over the ink (how dark the grain reads).
export const CHALK_GRAIN: Grain = { edge: "chalk", reach: 0.1, core: "chalkCore", tone: "rgba(120,120,112,0.22)" };
export const CRAYON_GRAIN: Grain = { edge: "crayon", reach: 0.09, core: "crayonCore", tone: "rgba(40,30,20,0.16)" };

/**
 * Fill `polys` into `dst` (white) with a broken, hand-made edge. The shape is blurred by
 * `radius`, then each pixel's blurred alpha is compared with edge noise: the edge bites in
 * or bulges out where the noise says, but nothing far inside can open up (no seams, no
 * see-through holes), and nothing far outside can appear.
 */
export const roughEdgeFill = (dst: Layer, polys: Pt[][], edge: EdgeName, off: Pt, radius: number) => {
  const tmp = scratch("rough-edge", dst);
  const { ctx, canvas } = tmp;
  ctx.filter = `blur(${Math.max(0.5, radius * dst.dpr)}px)`;
  ctx.fillStyle = "#fff";
  ctx.fill(toPath2D(polys));
  ctx.filter = "none";
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const noise = edgeNoise(edge);
  const inv = 1 / dst.dpr;
  // Antialiasing width: about one device pixel of the blurred ramp.
  const aa = Math.min(0.5, 0.5 / Math.max(1, radius * dst.dpr));
  for (let y = 0; y < h; y++) {
    const ny = (((Math.floor(dst.bbox.y + y * inv + off[1]) % TILE) + TILE) % TILE) * TILE;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3;
      const a = d[i] / 255;
      if (a <= 0.01) continue;
      if (a >= 0.99) {
        d[i] = 255;
        continue;
      }
      const g = 0.22 + 0.56 * noise[ny + ((((Math.floor(dst.bbox.x + x * inv + off[0]) % TILE) + TILE) % TILE))];
      const t = (a - g) / aa + 0.5;
      d[i] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  dst.draw(tmp);
};

/** Textured mark into `dst`, in `color`: broken edge, solid inside, grain painted on as tone. */
const grainedMark = (dst: Layer, strokes: Stroke[], grain: Grain, color: string, off: Pt, counts?: number[]) => {
  const full = strokes.map((s, i) => outline(s, counts?.[i]));
  const size = Math.max(...strokes.map((s) => s.size));
  roughEdgeFill(dst, full, grain.edge, off, size * grain.reach);
  dst.tint(color);
  const tone = scratch("grain-tone", dst);
  tone.draw(dst);
  tone.mask(grain.core, [off[1] * 0.7 + 311, off[0] * 0.7 + 97]);
  tone.tint(grain.tone);
  dst.draw(tone, "source-atop");
};

/** Chalk: one colour, everything through the chalk grain. */
export const chalkInk = (out: Layer, strokes: Stroke[], color: string, off: Pt, counts?: number[]) => {
  const mark = scratch("chalk-mark", out);
  grainedMark(mark, strokes, CHALK_GRAIN, color, off, counts);
  out.draw(mark);
};

/**
 * Crayon: each stroke is laid separately; where it crosses wax already on the layer,
 * the crossing is darkened a little, like a second pass of crayon.
 */
export const crayonInk = (out: Layer, strokes: Stroke[], color: string, off: Pt) => {
  strokes.forEach((s, i) => {
    const mark = scratch("crayon-mark", out);
    grainedMark(mark, [s], CRAYON_GRAIN, color, [off[0] + i * 173, off[1] + i * 59]);
    const overlap = scratch("crayon-overlap", out);
    overlap.draw(mark);
    overlap.draw(out, "destination-in");
    overlap.tint("#000");
    out.draw(mark);
    out.draw(overlap, "source-atop", 0.22);
  });
};

/** Lines along a stroke, offset sideways from its centre line by `k` x the local half-width. */
export const offsetLine = (s: Stroke, k: number, from: number, to: number, wander = 0, phase = 0): Pt[] => {
  const pts: Pt[] = [];
  const n = s.pts.length;
  const thin = s.thinning ?? 0.6;
  for (let i = Math.max(0, from); i < Math.min(n, to); i++) {
    const a = s.pts[Math.max(0, i - 1)];
    const b = s.pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const r = s.size * (0.5 - thin * (0.5 - s.pressure[i]));
    // A bristle doesn't stay parallel to the edge: let it drift across the stroke.
    const kk = k + wander * Math.sin(i * 0.045 + phase) + wander * 0.5 * Math.sin(i * 0.13 + phase * 2.3);
    pts.push([s.pts[i][0] - (dy / len) * r * kk, s.pts[i][1] + (dx / len) * r * kk]);
  }
  return pts;
};

export type Streak = { k: number; from: number; width: number; dash: number[]; dashOff: number; wander: number; phase: number };

/**
 * Dry brush: tapered outline with a ragged edge, then thin streaks cut out along the
 * stroke where the bristles ran dry. `counts` draws strokes on partially.
 */
export const brushInk = (
  out: Layer,
  strokes: Stroke[],
  streaks: Streak[][],
  color: string,
  off: Pt,
  counts?: number[],
  /** null: streaks cut through to the background. A colour: streaks are painted in that tone
   * instead, so a green-screen version has no hairline gaps for the key to half-catch. */
  streakTone: string | null = null,
) => {
  const mark = scratch("brush-mark", out);
  const full = strokes.map((s, i) => outline(s, counts?.[i]));
  const solids = strokes.flatMap((s, i) => (s.solid ? [s.pts.slice(0, counts?.[i] ?? s.pts.length)] : []));
  const size = Math.max(...strokes.map((s) => s.size));
  roughEdgeFill(mark, [...full, ...solids], "brush", off, size * 0.08);
  mark.tint(color);
  const { ctx } = mark;
  ctx.save();
  ctx.globalCompositeOperation = streakTone ? "source-atop" : "destination-out";
  ctx.strokeStyle = streakTone ?? "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach((s, i) => {
    const end = counts?.[i] ?? s.pts.length;
    for (const st of streaks[i] ?? []) {
      const from = Math.floor(st.from * s.pts.length);
      if (end - from < 3) continue;
      const line = offsetLine(s, st.k, from, end, st.wander, st.phase);
      ctx.setLineDash(st.dash);
      ctx.lineDashOffset = st.dashOff;
      // Width swells and thins along the streak, in short runs.
      for (let j = 0; j + 1 < line.length; j += 4) {
        ctx.lineWidth = st.width * (0.55 + 0.45 * Math.abs(Math.sin(j * 0.07 + st.phase)));
        ctx.beginPath();
        ctx.moveTo(line[j][0], line[j][1]);
        for (let q = j + 1; q <= Math.min(line.length - 1, j + 4); q++) ctx.lineTo(line[q][0], line[q][1]);
        ctx.stroke();
        ctx.lineDashOffset -= Math.hypot(line[Math.min(line.length - 1, j + 4)][0] - line[j][0], line[Math.min(line.length - 1, j + 4)][1] - line[j][1]);
      }
    }
  });
  ctx.restore();
  out.draw(mark);
};
