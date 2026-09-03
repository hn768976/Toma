/**
 * The print mask.
 *
 * The source PNG is a black-on-white fingerprint. It is read once, its pixels
 * turned into an alpha channel — dark ridge pixels opaque, white background
 * transparent — and pre-tinted into the palette's ridge colours. The source
 * image's own black is never shown; everything downstream draws through this.
 */
import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { PRINT_HEIGHT, PRINT_WIDTH } from "../layout";

export type PrintMask = {
  /** White ridges with the mask in the alpha channel, at print size. */
  alpha: HTMLCanvasElement;
  /** Per-pixel ridge coverage 0..255, for snapping markers onto ridges. */
  coverage: Uint8ClampedArray;
  width: number;
  height: number;
};

const buildMask = (img: HTMLImageElement): PrintMask => {
  const width = PRINT_WIDTH;
  const height = PRINT_HEIGHT;

  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(img, 0, 0, width, height);

  const data = sctx.getImageData(0, 0, width, height);
  const px = data.data;
  const coverage = new Uint8ClampedArray(width * height);

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    // Luminance of the source; dark ridge -> opaque, white paper -> transparent.
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    // A little contrast so anti-aliased ridge edges stay soft but the paper
    // goes fully clear rather than leaving a grey film.
    const a = Math.max(0, Math.min(1, (1 - lum - 0.06) / 0.76));
    coverage[p] = Math.round(a * 255);
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = coverage[p];
  }
  sctx.putImageData(data, 0, 0);

  return { alpha: src, coverage, width, height };
};

/** A copy of the mask filled with one flat colour. Built once per colour. */
export const tintMask = (mask: PrintMask, color: string): HTMLCanvasElement => {
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
 * Loads and builds the mask exactly once. The delayRender handle is only
 * released when the bitmap is decoded and converted, so frame 0 is never
 * captured with a missing print.
 */
export const usePrintMask = (): PrintMask | null => {
  const [mask, setMask] = useState<PrintMask | null>(null);
  const handle = useMemo(() => delayRender("fingerprint: print mask"), []);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setMask(buildMask(img));
      continueRender(handle);
    };
    img.onerror = () => continueRender(handle);
    img.src = staticFile("fingerprint.png");
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return mask;
};
