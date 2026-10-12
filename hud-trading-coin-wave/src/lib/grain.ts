import { hash3, loopFrame } from "./random";

export type GrainOptions = {
  /** Grain amplitude as a fraction of full scale (≈0.015). */
  amount: number;
  /** If true, grain and dither fade to zero below ~3% luminance (overlay looks). */
  cleanBlack: boolean;
};

/**
 * Film grain + ±1/255 dither, a fixed function of (x, y, frame % 600).
 * Applied to the finished 8-bit canvas in place.
 */
export const applyGrain = (ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, o: GrainOptions) => {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const f = loopFrame(frame);
  const amp = o.amount * 255;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let k = 1;
      if (o.cleanBlack) {
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (lum < 0.03) continue;
        k = lum >= 0.06 ? 1 : ((lum - 0.03) / 0.03) ** 2;
      }
      const hh = hash3(x, y, f);
      // two 16-bit uniforms → triangular grain; low bits → dither
      const u1 = (hh & 0xffff) / 65535;
      const u2 = (hh >>> 16) / 65535;
      const n = (u1 + u2 - 1) * amp + (u1 - 0.5) * 2;
      const v = n * k;
      d[i] = r + v;
      d[i + 1] = g + v;
      d[i + 2] = b + v;
    }
  }
  ctx.putImageData(img, 0, 0);
};
