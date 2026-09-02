import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";

export type SvgSpriteSet = {
  /** One pre-tinted bitmap per depth step; index 0 = t 0, last = t 1. */
  steps: HTMLCanvasElement[];
  width: number;
  height: number;
  /**
   * width / height of the RASTERISED bitmap, not of the source viewBox. Blit
   * with this: the raster's width is rounded to whole pixels, so using the
   * viewBox aspect instead stretches every instance by a fraction of a pixel.
   */
  aspect: number;
};

export type UseSvgSpritesOptions = {
  /** URL of the SVG — in Remotion, staticFile("thing.svg"). */
  src: string;
  /** Raster height in pixels. Size it to the largest SHARP instance. */
  spriteHeight: number;
  /** How many pre-tinted copies to build. */
  steps: number;
  /**
   * Flat colour for depth `t` (0..1). Return any canvas fillStyle string.
   * Keeping this a function is what makes the component palette-agnostic.
   */
  tintAt: (t: number) => string;
};

/**
 * Loads an SVG, rasterises it ONCE, and returns a small set of pre-tinted
 * bitmaps ready to be blitted.
 *
 * This exists because the two obvious approaches are both unusable at 4K:
 * re-parsing the SVG per instance per frame, and recolouring each instance
 * with its own source-in pass. Quantising the tint into a handful of steps up
 * front reduces every instance to a single drawImage() with a transform.
 *
 * The SVG's intrinsic size is rewritten to the raster size before decoding, so
 * Chrome rasterises the vector at full resolution instead of rasterising at the
 * authored size and scaling the bitmap up.
 */
export const useSvgSprites = ({
  src,
  spriteHeight,
  steps,
  tintAt,
}: UseSvgSpritesOptions): SvgSpriteSet | null => {
  const [loaded, setLoaded] = useState<{
    image: HTMLImageElement;
    aspect: number;
  } | null>(null);

  useEffect(() => {
    const handle = delayRender(`Rasterising ${src}`);
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      const markup = await (await fetch(src)).text();
      const aspect = readAspect(markup);
      const width = Math.max(1, Math.round(spriteHeight * aspect));
      const sized = markup
        .replace(/\swidth="[^"]*"/, ` width="${width}"`)
        .replace(/\sheight="[^"]*"/, ` height="${spriteHeight}"`);
      const blob = new Blob([sized], { type: "image/svg+xml" });
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (!cancelled) setLoaded({ image, aspect });
    };

    load()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, spriteHeight]);

  return useMemo(() => {
    if (!loaded) return null;
    const height = spriteHeight;
    const width = Math.max(1, Math.round(spriteHeight * loaded.aspect));

    const tinted = new Array(steps).fill(0).map((_, i) => {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;
      ctx.drawImage(loaded.image, 0, 0, width, height);
      // Keep only the artwork's alpha, then flood it with the depth colour.
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = tintAt(t);
      ctx.fillRect(0, 0, width, height);
      return canvas;
    });

    return { steps: tinted, width, height, aspect: width / height };
  }, [loaded, spriteHeight, steps, tintAt]);
};

/** Prefers the viewBox, since width/height may carry units or be absent. */
const readAspect = (markup: string): number => {
  const viewBox = /viewBox="([\d.\-+eE\s,]+)"/.exec(markup);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return parts[2] / parts[3];
    }
  }
  const w = /\swidth="([\d.]+)"/.exec(markup);
  const h = /\sheight="([\d.]+)"/.exec(markup);
  if (w && h && Number(h[1]) > 0) return Number(w[1]) / Number(h[1]);
  return 1;
};
