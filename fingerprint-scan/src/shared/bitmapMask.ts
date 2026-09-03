/**
 * Turns a high-contrast bitmap (dark marks on a light ground) into an alpha
 * mask, so downstream drawing can render the marks in any colour and the
 * source image's own ink is never shown.
 *
 * Subject-agnostic: works for line art, maps, type, fingerprints — anything
 * that reads as dark-on-light.
 */
import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";

export type BitmapMask = {
  /** White marks carrying the mask in the alpha channel, at the requested size. */
  alpha: HTMLCanvasElement;
  /** Per-pixel coverage 0..255, row-major, for hit-testing against the marks. */
  coverage: Uint8ClampedArray;
  width: number;
  height: number;
};

export type MaskOptions = {
  /** Luminance below which a pixel is fully opaque ink. Default 0.06 headroom. */
  floor?: number;
  /** Luminance span over which coverage ramps to zero. Default 0.76. */
  span?: number;
  /** Set true if the source is light marks on a dark ground. */
  invert?: boolean;
};

export const maskFromImage = (
  img: CanvasImageSource,
  width: number,
  height: number,
  opts: MaskOptions = {},
): BitmapMask => {
  const { floor = 0.06, span = 0.76, invert = false } = opts;

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const coverage = new Uint8ClampedArray(width * height);

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    const ink = invert ? lum : 1 - lum;
    // A little contrast, so anti-aliased edges stay soft but the ground goes
    // fully clear instead of leaving a grey film.
    const a = Math.max(0, Math.min(1, (ink - floor) / span));
    coverage[p] = Math.round(a * 255);
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = coverage[p];
  }
  ctx.putImageData(data, 0, 0);

  return { alpha: c, coverage, width, height };
};

/** A copy of the mask filled with one flat colour. Build once per colour. */
export const tintMask = (mask: BitmapMask, color: string): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = mask.width;
  c.height = mask.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(mask.alpha, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, mask.width, mask.height);
  return c;
};

/**
 * Loads `src` and builds its mask exactly once, holding a delayRender handle
 * until the bitmap is decoded and converted — so frame 0 is never captured with
 * the artwork missing.
 */
export const useBitmapMask = (
  src: string,
  width: number,
  height: number,
  opts: MaskOptions = {},
): BitmapMask | null => {
  const [mask, setMask] = useState<BitmapMask | null>(null);
  const handle = useMemo(() => delayRender(`bitmap mask: ${src}`), [src]);
  const key = JSON.stringify(opts);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setMask(maskFromImage(img, width, height, JSON.parse(key) as MaskOptions));
      continueRender(handle);
    };
    img.onerror = () => continueRender(handle);
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, width, height, key, handle]);

  return mask;
};
