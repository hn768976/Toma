/**
 * Loads the tree silhouettes as alpha masks.
 *
 * Two shapes of source are supported, because they solve different problems:
 *
 * - **SVG** (what ships here) carries its own alpha and has no resolution
 *   ceiling, so a near-tier instance stays sharp however large it is drawn.
 *   Nothing to convert — the file is handed straight to CSS as a mask.
 * - **PNG**, expected to be black artwork on an opaque white background rather
 *   than a transparent cutout, is luminance-keyed to alpha here. Drop raster
 *   artwork into public/trees/ and point TREE_SOURCES at it and it just works,
 *   though tools/trace-trees.mjs will give a better result.
 *
 * Either way the work happens exactly once per browser context: the promise
 * cache below lives at module scope, so every frame and every tree instance
 * reuses the same result rather than re-keying 20 megapixels 600 times over.
 */

import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

export const TREE_SOURCES = [
  "trees/Untitled_design__4_.svg", // slim bare tree, long clean trunk
  "trees/Untitled_design__2_.svg", // dense bare oak, many fine twigs
  "trees/Untitled_design__3_.svg", // wide spreading dead tree
] as const;

export type TreeMask = {
  /** URL usable as a CSS mask image. */
  url: string;
  width: number;
  height: number;
  /** width / height — the layout needs it to size instances from a height. */
  aspect: number;
};

// A soft luminance ramp rather than a hard threshold, for the PNG path.
// Anything at or below LO is fully opaque, anything at or above HI fully clear,
// and the band between keeps the artwork's antialiasing — a hard cut here eats
// the finest twigs, which are exactly the detail the tangled crowns are made of.
const LO = 0.18;
const HI = 0.88;

const cache = new Map<string, Promise<TreeMask>>();

/** SVG masks need no conversion; only their intrinsic size has to be read. */
const loadSvg = async (src: string): Promise<TreeMask> => {
  const text = await (await fetch(src)).text();
  const attr = (name: string) =>
    Number(new RegExp(`\\b${name}="([\\d.]+)"`).exec(text)?.[1]);
  let width = attr("width");
  let height = attr("height");

  if (!width || !height) {
    const box = /viewBox="([-\d.\s]+)"/.exec(text)?.[1]?.trim().split(/\s+/);
    if (box?.length === 4) {
      width = Number(box[2]);
      height = Number(box[3]);
    }
  }
  if (!width || !height) {
    throw new Error(`Could not determine intrinsic size of ${src}`);
  }
  return { url: src, width, height, aspect: width / height };
};

/** Black-on-white raster artwork, keyed to alpha by luminance. */
const keyPng = async (src: string): Promise<TreeMask> => {
  const bitmap = await createImageBitmap(await (await fetch(src)).blob());
  const { width, height } = bitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not acquire a 2D context for keying");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const ramp = (lum - LO) / (HI - LO);
    const alpha = 1 - Math.min(1, Math.max(0, ramp));
    // The mask only reads alpha, but zeroing RGB keeps the PNG small and avoids
    // any chance of white fringing if it is ever drawn directly.
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(image, 0, 0);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { url: URL.createObjectURL(blob), width, height, aspect: width / height };
};

const getMask = (src: string) => {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = src.toLowerCase().endsWith(".svg") ? loadSvg(src) : keyPng(src);
  cache.set(src, pending);
  return pending;
};

/**
 * Resolves to the tree masks, or null on the first render pass. Callers must
 * render nothing until it is non-null — `delayRender` holds the frame until
 * then, so no frame is ever captured with the trees missing.
 */
export const useTreeMasks = (): TreeMask[] | null => {
  const [masks, setMasks] = useState<TreeMask[] | null>(null);
  const [handle] = useState(() => delayRender("Loading tree silhouette masks"));

  useEffect(() => {
    let live = true;
    Promise.all(TREE_SOURCES.map((s) => getMask(staticFile(s))))
      .then((loaded) => {
        if (live) setMasks(loaded);
        continueRender(handle);
      })
      // Surface the real cause rather than letting the frame time out with a
      // generic delayRender message.
      .catch((err) => cancelRender(err));
    return () => {
      live = false;
    };
  }, [handle]);

  return masks;
};
