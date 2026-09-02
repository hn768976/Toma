import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { SPRITE_HEIGHT, TINT_STEPS } from "./constants";
import { treeTintAt } from "./variants";
import type { Palette } from "./variants";

export type TreeSprites = {
  /** One pre-tinted bitmap per depth step, index 0 = nearest, last = farthest. */
  steps: HTMLCanvasElement[];
  width: number;
  height: number;
};

/**
 * The tree silhouette is parsed and rasterised EXACTLY ONCE, into a small set
 * of pre-tinted bitmaps. Every one of the ~84 instances per frame is then a
 * single drawImage() of one of those bitmaps.
 *
 * Re-parsing the SVG per instance per frame — or recolouring each instance with
 * a source-in pass — is what makes a scene like this unrenderable at 4K, so
 * neither happens: the only per-instance work is a transform and a blit.
 *
 * The tint ramp runs tree-near -> tree-mid -> tree-far -> fog, so an instance's
 * colour is a pure function of its depth and the bands blend into the haze
 * continuously rather than in three visible steps.
 */
export const useTreeSprites = (palette: Palette): TreeSprites | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const handle = delayRender("Rasterising tree.svg");
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      const source = await fetch(staticFile("tree.svg"));
      const markup = await source.text();
      // Pin the SVG's intrinsic size to the raster size we actually want, so
      // Chrome rasterises the vector at full resolution instead of rasterising
      // at its authored size and then scaling the bitmap up.
      const aspect = 944 / 1856;
      const sized = markup
        .replace(/width="[^"]*"/, `width="${Math.round(SPRITE_HEIGHT * aspect)}"`)
        .replace(/height="[^"]*"/, `height="${SPRITE_HEIGHT}"`);
      const blob = new Blob([sized], { type: "image/svg+xml" });
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      if (!cancelled) setImage(img);
    };

    load()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return useMemo(() => {
    if (!image) return null;
    const height = SPRITE_HEIGHT;
    const width = Math.round(SPRITE_HEIGHT * (944 / 1856));

    const steps = new Array(TINT_STEPS).fill(0).map((_, i) => {
      const t = i / (TINT_STEPS - 1);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;
      ctx.drawImage(image, 0, 0, width, height);
      // Recolour the silhouette by keeping only its alpha and flooding it.
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = treeTintAt(palette, t);
      ctx.fillRect(0, 0, width, height);
      return canvas;
    });

    return { steps, width, height };
  }, [image, palette]);
};
