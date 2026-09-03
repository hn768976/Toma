import type { Ctx } from "./canvas";

/**
 * A sample on a polyline that carries its own half-width and unit normal, so
 * a run of them describes a stroke whose thickness varies along its length.
 */
export type TaperedSample = {
  x: number;
  y: number;
  /** Unit normal. */
  nx: number;
  ny: number;
  /** Half-width at this sample, in canvas px. */
  w: number;
};

/**
 * Fill a stretch of a tapered polyline as a single polygon: the outline is
 * walked forward down one side and back up the other, so the width can change
 * sample by sample in one fill call.
 *
 * A uniform thick stroke reads flat; this does not. It is also far cheaper
 * than stroking each segment separately, which matters at 4K.
 *
 * @param from  first sample index, inclusive
 * @param to    last sample index, inclusive
 * @param widthMul  multiplies every sample's half-width (use >1 for a glow
 *                  pass under a core pass)
 * @param fill  any canvas fillStyle string
 */
export const fillTapered = (
  ctx: Ctx,
  samples: readonly TaperedSample[],
  from: number,
  to: number,
  widthMul: number,
  fill: string,
  /** Optional per-sample positions overriding samples[i].x/y. */
  positions?: Float64Array,
) => {
  const px = (i: number) => (positions ? positions[i * 2] : samples[i].x);
  const py = (i: number) => (positions ? positions[i * 2 + 1] : samples[i].y);

  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const s = samples[i];
    const w = s.w * widthMul;
    const x = px(i) + s.nx * w;
    const y = py(i) + s.ny * w;
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = to; i >= from; i--) {
    const s = samples[i];
    const w = s.w * widthMul;
    ctx.lineTo(px(i) - s.nx * w, py(i) - s.ny * w);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

/**
 * Split a polyline of `n` samples into overlapping index ranges of `size`
 * segments each. Filling chunk by chunk lets colour, alpha and depth bucket
 * vary along a curve while still using ordinary polygon fills.
 */
export const chunkRanges = (n: number, size: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let a = 0; a < n - 1; a += size) {
    out.push([a, Math.min(a + size, n - 1)]);
  }
  return out;
};

/**
 * Fill in unit normals for a raw point list, from the direction between each
 * point's neighbours.
 */
export const normalsFor = (
  pts: readonly { x: number; y: number }[],
): { nx: number; ny: number }[] => {
  const n = pts.length;
  const out: { nx: number; ny: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    out[i] = { nx: -ty, ny: tx };
  }
  return out;
};
