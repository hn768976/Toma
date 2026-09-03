import {
  CHUNK,
  DOF_FAR,
  DOF_FEATHER,
  DOF_NEAR,
} from "./constants";
import { clamp, undulate, type Strand } from "./geometry";
import { rgba, type Rgb } from "./color";

export type Ctx = CanvasRenderingContext2D;

/**
 * Per-frame sample positions for a strand: the memoised base geometry plus
 * the undulation offset and the ambient camera drift. Nothing here is
 * regenerated per frame except these numbers.
 */
export const computePositions = (
  s: Strand,
  p: number,
  camX: number,
  camY: number,
): Float64Array => {
  const n = s.samples.length;
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const sm = s.samples[i];
    const o = undulate(s, i, p);
    out[i * 2] = sm.x + sm.nx * o + camX;
    out[i * 2 + 1] = sm.y + sm.ny * o + camY;
  }
  return out;
};

/**
 * Cross-fade weights for the three depth-of-field buckets. A sample sitting
 * in a feather zone is drawn into both neighbouring buffers at complementary
 * alphas; because the buffers composite with 'lighter', the two halves sum
 * back to full brightness and no seam appears.
 */
export const bucketWeights = (d: number): [number, number, number] => {
  const ramp = (edge: number) =>
    clamp((d - (edge - DOF_FEATHER)) / (2 * DOF_FEATHER), 0, 1);
  const near = ramp(DOF_NEAR);
  const midHigh = 1 - near;
  const farRamp = ramp(DOF_FAR);
  const far = 1 - farRamp;
  const mid = clamp(midHigh - far, 0, 1);
  return [near, mid, far];
};

/**
 * Fill one chunk of a strand as a tapered polygon: the outline is walked
 * forward down one side and back up the other, so the width can vary sample
 * by sample in a single fill. A uniform thick stroke reads flat; this does
 * not.
 */
export const fillTapered = (
  ctx: Ctx,
  s: Strand,
  pos: Float64Array,
  from: number,
  to: number,
  widthMul: number,
  fill: string,
) => {
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const sm = s.samples[i];
    const w = sm.w * widthMul;
    const x = pos[i * 2] + sm.nx * w;
    const y = pos[i * 2 + 1] + sm.ny * w;
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = to; i >= from; i--) {
    const sm = s.samples[i];
    const w = sm.w * widthMul;
    ctx.lineTo(pos[i * 2] - sm.nx * w, pos[i * 2 + 1] - sm.ny * w);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

/** Chunk boundaries for a strand, so brightness can vary along its length. */
export const chunksOf = (n: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let a = 0; a < n - 1; a += CHUNK) {
    out.push([a, Math.min(a + CHUNK, n - 1)]);
  }
  return out;
};

/** A soft radial disc — used for packets, bokeh and the horizon bloom. */
export const radialBlob = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  inner: Rgb,
  outer: Rgb,
  alpha: number,
  stops: number = 0.42,
) => {
  if (r <= 0.4 || alpha <= 0.002) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(inner, alpha));
  g.addColorStop(stops, rgba(outer, alpha * 0.34));
  g.addColorStop(1, rgba(outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** Allocate an offscreen canvas at a given size. */
export const makeBuffer = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
