import { staticFile } from "remotion";
import { clamp01, smoothstep } from "./prng";

/**
 * The tree silhouettes are black-on-white PNGs, not transparent ones, so they
 * are keyed to alpha once at module level and cached. The ramp is deliberately
 * soft rather than a hard threshold: the fine twigs are anti-aliased greys, and
 * a threshold would eat exactly the detail the fog needs to catch.
 */

export type TreeKey = "dense" | "wide" | "slim";

/**
 * Drop-in replacement point: swap these files for the originals
 * (Untitled_design__2_.png / __3_ / __4_) and nothing else needs to change,
 * as long as the replacements are also black-on-white with the trunk base at
 * the bottom centre of the image.
 */
export const TREE_FILES: Record<TreeKey, string> = {
  dense: "trees/tree-dense-oak.png", // dense bare oak — mid tiers
  wide: "trees/tree-wide-dead.png", // wide spreading dead tree — near tier
  slim: "trees/tree-slim-sparse.png", // slim sparse tree — far tiers
};

/** Luminance below this is fully opaque; above WHITE_POINT, fully clear. */
const BLACK_POINT = 30;
const WHITE_POINT = 238;

export type KeyedTree = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

const keyed = new Map<TreeKey, KeyedTree>();
const tinted = new Map<string, HTMLCanvasElement>();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

const keyToAlpha = (img: HTMLImageElement): KeyedTree => {
  const { naturalWidth: w, naturalHeight: h } = img;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    // Rec. 709 luma — the assets are greyscale, but this stays correct if a
    // replacement asset carries any colour cast.
    const lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
    const a = 1 - smoothstep(BLACK_POINT, WHITE_POINT, lum);
    p[i] = 0;
    p[i + 1] = 0;
    p[i + 2] = 0;
    p[i + 3] = Math.round(clamp01(a) * 255);
  }
  ctx.putImageData(data, 0, 0);
  return { canvas, width: w, height: h };
};

let loadPromise: Promise<void> | null = null;

/** Loads and keys every silhouette once; safe to call repeatedly. */
export const loadTrees = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = Promise.all(
      (Object.keys(TREE_FILES) as TreeKey[]).map(async (key) => {
        const img = await loadImage(staticFile(TREE_FILES[key]));
        keyed.set(key, keyToAlpha(img));
      }),
    ).then(() => undefined);
  }
  return loadPromise;
};

export const getKeyedTree = (key: TreeKey): KeyedTree => {
  const t = keyed.get(key);
  if (!t) throw new Error(`Tree ${key} was drawn before loadTrees() resolved`);
  return t;
};

/**
 * A silhouette pre-filled with a tier colour. Tinting per frame would mean an
 * offscreen composite per tree per frame; doing it once per (tree, colour) pair
 * and caching keeps the per-frame cost to a plain drawImage.
 */
export const getTintedTree = (key: TreeKey, color: string) => {
  const cacheKey = `${key}|${color}`;
  const hit = tinted.get(cacheKey);
  if (hit) return hit;

  const base = getKeyedTree(key);
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, base.width, base.height);
  tinted.set(cacheKey, canvas);
  return canvas;
};
