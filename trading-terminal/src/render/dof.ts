import { scratch } from "./canvasPool";

/**
 * Tilt-shift depth of field from blurred copies of the screen.
 *
 * For a flat screen, texture-space blur radius is proportional to
 * |depth - focusDepth|, and depth is linear across the screen
 * (depth = a·x + b·y + c). So each blur level is blended in with a linear
 * gradient mask along the depth gradient – exact for a tilted plane.
 */
export interface DofParams {
  /** Texture px per logical unit. */
  ts: number;
  /** depth(x, y) - focusDepth = a·x + b·y + c  (logical units). */
  a: number;
  b: number;
  c: number;
  /** Blur (logical units, Gaussian sigma) per unit of depth difference. */
  k: number;
  /** Extra blur everywhere (logical units). */
  base?: number;
  /** Cap on blur (logical units). */
  max: number;
}

// Blur levels in logical units. Level 0 is the sharp screen.
const LEVELS = [0, 1.6, 4, 9, 18, 34, 60];

export const composeDof = (
  out: CanvasRenderingContext2D,
  sharp: HTMLCanvasElement,
  W: number,
  H: number,
  d: DofParams,
) => {
  const TW = sharp.width;
  const TH = sharp.height;
  const levels = LEVELS.filter((l) => l <= d.max * 1.01);
  if (levels[levels.length - 1] < d.max) levels.push(d.max);

  // Pyramid: each level drawn from the previous one, downsampled when the
  // blur is wide enough that the detail is gone anyway.
  const imgs: { canvas: HTMLCanvasElement; ds: number }[] = [{ canvas: sharp, ds: 1 }];
  let prevSigmaTex = 0;
  for (let i = 1; i < levels.length; i++) {
    const sigTex = levels[i] * d.ts;
    let ds = 1;
    while (sigTex / (ds * 2) >= 2.5 && ds < 32) ds *= 2;
    const w = Math.ceil(TW / ds);
    const h = Math.ceil(TH / ds);
    const { canvas, ctx } = scratch(`dof${i}`, w, h);
    const prev = imgs[i - 1];
    const add = Math.sqrt(Math.max(0, sigTex * sigTex - prevSigmaTex * prevSigmaTex));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Opaque edge so blurring doesn't pull in transparency at the borders.
    ctx.drawImage(prev.canvas, 0, 0, w, h);
    ctx.filter = `blur(${(add / ds).toFixed(3)}px)`;
    ctx.drawImage(prev.canvas, 0, 0, w, h);
    ctx.filter = "none";
    imgs.push({ canvas, ds });
    prevSigmaTex = sigTex;
  }

  // Blur radius at a logical point.
  const g2 = d.a * d.a + d.b * d.b;
  const blurAt = (x: number, y: number) =>
    Math.min(d.max, (d.base ?? 0) + d.k * Math.abs(d.a * x + d.b * y + d.c));
  const corners = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ].map(([x, y]) => d.a * x + d.b * y + d.c);
  const sMin = Math.min(...corners);
  const sMax = Math.max(...corners);
  // Point (logical) where signed depth difference equals s.
  const at = (s: number): [number, number] =>
    g2 < 1e-12 ? [0, 0] : [((s - d.c) * d.a) / g2, ((s - d.c) * d.b) / g2];

  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = "high";
  const top = imgs[imgs.length - 1];
  out.drawImage(top.canvas, 0, 0, TW, TH);

  const minBlur = Math.min(...[[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => blurAt(x, y)));
  const zeroInside = sMin < 0 && sMax > 0;
  const lowest = zeroInside ? (d.base ?? 0) : minBlur;

  for (let i = levels.length - 2; i >= 0; i--) {
    const lo = levels[i];
    const hi = levels[i + 1];
    // Level i is used where blur < hi.
    if (lowest >= hi) continue;
    const alphaOf = (s: number) => {
      const r = Math.min(d.max, (d.base ?? 0) + d.k * Math.abs(s));
      return Math.max(0, Math.min(1, (hi - r) / (hi - lo)));
    };
    const img = imgs[i];
    const { canvas: tmp, ctx: tctx } = scratch(`mask${i}`, img.canvas.width, img.canvas.height);
    tctx.drawImage(img.canvas, 0, 0);
    tctx.globalCompositeOperation = "destination-in";
    if (g2 < 1e-12) {
      tctx.globalAlpha = alphaOf(d.c);
      tctx.fillRect(0, 0, tmp.width, tmp.height);
    } else {
      const k = d.ts / img.ds;
      const p0 = at(sMin);
      const p1 = at(sMax);
      const grad = tctx.createLinearGradient(p0[0] * k, p0[1] * k, p1[0] * k, p1[1] * k);
      const base = d.base ?? 0;
      const sHi = Math.max(0, (hi - base) / d.k);
      const sLo = Math.max(0, (lo - base) / d.k);
      const ss = [sMin, sMax, -sHi, -sLo, sLo, sHi, 0].filter((s) => s >= sMin && s <= sMax);
      ss.sort((x, y) => x - y);
      for (const s of ss) {
        const f = sMax - sMin < 1e-9 ? 0 : (s - sMin) / (sMax - sMin);
        grad.addColorStop(f, `rgba(0,0,0,${alphaOf(s).toFixed(4)})`);
      }
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
    }
    tctx.globalCompositeOperation = "source-over";
    out.drawImage(tmp, 0, 0, TW, TH);
  }
  void blurAt;
};
