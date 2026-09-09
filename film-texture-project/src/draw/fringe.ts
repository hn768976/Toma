import type {DrawCtx} from './types';

/** Maximum channel separation, in output device pixels. */
const MAX_SHIFT = 2;
/** Fraction of the frame the fringing reaches in from each edge. */
const BAND = 0.075;

const shiftHorizontal = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  bandW: number,
  h: number,
  fromLeft: boolean,
): void => {
  if (bandW < 4 || h < 1) {
    return;
  }
  const img = ctx.getImageData(x0, 0, bandW, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);

  for (let x = 0; x < bandW; x++) {
    const edgeDist = fromLeft ? x : bandW - 1 - x;
    // Ramp from full separation at the extreme edge to none by the band's end.
    const shift = Math.round(MAX_SHIFT * (1 - edgeDist / bandW));
    if (shift === 0) {
      continue;
    }
    const xr = Math.min(bandW - 1, Math.max(0, x + shift));
    const xc = Math.min(bandW - 1, Math.max(0, x - shift));
    for (let y = 0; y < h; y++) {
      const row = y * bandW * 4;
      const i = row + x * 4;
      out[i] = src[row + xr * 4]; // red pulled one way
      out[i + 1] = src[row + xc * 4 + 1]; // cyan (G+B) the other
      out[i + 2] = src[row + xc * 4 + 2];
    }
  }

  img.data.set(out);
  ctx.putImageData(img, x0, 0);
};

const shiftVertical = (
  ctx: CanvasRenderingContext2D,
  y0: number,
  bandH: number,
  w: number,
  fromTop: boolean,
): void => {
  if (bandH < 4 || w < 1) {
    return;
  }
  const img = ctx.getImageData(0, y0, w, bandH);
  const src = img.data;
  const out = new Uint8ClampedArray(src);

  for (let y = 0; y < bandH; y++) {
    const edgeDist = fromTop ? y : bandH - 1 - y;
    const shift = Math.round(MAX_SHIFT * (1 - edgeDist / bandH));
    if (shift === 0) {
      continue;
    }
    const yr = Math.min(bandH - 1, Math.max(0, y + shift));
    const yc = Math.min(bandH - 1, Math.max(0, y - shift));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[i] = src[(yr * w + x) * 4];
      out[i + 1] = src[(yc * w + x) * 4 + 1];
      out[i + 2] = src[(yc * w + x) * 4 + 2];
    }
  }

  img.data.set(out);
  ctx.putImageData(img, 0, y0);
};

/**
 * Chromatic fringing at the extreme frame edges only.
 *
 * Because this is a channel *displacement* rather than a tint, a uniform field
 * comes out exactly as it went in: clean white stays 255,255,255 and only the
 * artifacts themselves pick up a red/cyan edge.
 */
export const applyFringe = (d: DrawCtx): void => {
  const {ctx, w, h} = d;
  const bandW = Math.round(w * BAND);
  const bandH = Math.round(h * BAND);
  shiftHorizontal(ctx, 0, bandW, h, true);
  shiftHorizontal(ctx, w - bandW, bandW, h, false);
  shiftVertical(ctx, 0, bandH, w, true);
  shiftVertical(ctx, h - bandH, bandH, w, false);
};
