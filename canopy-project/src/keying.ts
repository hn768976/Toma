/**
 * The supplied tree silhouettes are black artwork on an opaque white
 * background, not transparent PNGs. This turns them into alpha masks.
 *
 * The work happens exactly once per browser context: the promise cache below
 * lives at module scope, so every frame and every tree instance reuses the same
 * decoded result rather than re-keying 20 megapixels 600 times over.
 */

import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

export const TREE_SOURCES = [
  "trees/Untitled_design__4_.png", // slim bare tree, long clean trunk
  "trees/Untitled_design__2_.png", // dense bare oak, many fine twigs
  "trees/Untitled_design__3_.png", // wide spreading dead tree
] as const;

export type KeyedTree = {
  /** Object URL of an alpha-only PNG, for use as a CSS mask. */
  url: string;
  width: number;
  height: number;
  /** width / height — the layout needs it to size instances from a height. */
  aspect: number;
};

// A soft luminance ramp rather than a hard threshold. Anything at or below LO
// is fully opaque, anything at or above HI is fully clear, and the band between
// keeps the rasteriser's antialiasing — a hard cut here eats the finest twigs,
// which are exactly the detail the tangled crowns are made of.
const LO = 0.18;
const HI = 0.88;

const cache = new Map<string, Promise<KeyedTree>>();

const keyOne = async (src: string): Promise<KeyedTree> => {
  const res = await fetch(src);
  const bitmap = await createImageBitmap(await res.blob());
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
    // The mask only reads alpha, but zeroing RGB keeps the PNG small and
    // avoids any chance of white fringing if it is ever drawn directly.
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(image, 0, 0);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { url: URL.createObjectURL(blob), width, height, aspect: width / height };
};

const getKeyed = (src: string) => {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = keyOne(src);
  cache.set(src, pending);
  return pending;
};

/**
 * Resolves to the keyed masks, or null on the first render pass. Callers must
 * render nothing until it is non-null — `delayRender` holds the frame until
 * then, so no frame is ever captured with the trees missing.
 */
export const useKeyedTrees = (): KeyedTree[] | null => {
  const [trees, setTrees] = useState<KeyedTree[] | null>(null);
  const [handle] = useState(() => delayRender("Keying tree silhouettes to alpha"));

  useEffect(() => {
    let live = true;
    Promise.all(TREE_SOURCES.map((s) => getKeyed(staticFile(s))))
      .then((keyed) => {
        if (live) setTrees(keyed);
        continueRender(handle);
      })
      // Surface the real cause rather than letting the frame time out with a
      // generic delayRender message.
      .catch((err) => cancelRender(err));
    return () => {
      live = false;
    };
  }, [handle]);

  return trees;
};
