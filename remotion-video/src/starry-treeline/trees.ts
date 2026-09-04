// Silhouette assets and treeline layout.
//
// The trees are SVGs traced from the supplied black-on-white PNGs with
// tools/trace-png-to-svg.mjs, so the treeline stays crisp at any output size.
// They are rasterised and cropped once at module level and cached, since doing
// that per frame per tree would dominate render time.
//
// The loader still accepts raw black-on-white PNGs, keyed with a soft
// luminance ramp — so an untraced PNG can be dropped straight in.
import { staticFile } from "remotion";
import { mulberry32 } from "../particle-ring/random";
import {
  HORIZON_BASE,
  HORIZON_RISE,
  SWAY_MAX_DEGREES,
  SWAY_PERIODS,
} from "./constants";

export const TREE_ASSETS = {
  single: "trees/Untitled_design__5_.svg",
  group: "trees/Untitled_design__6_.svg",
  bare: "trees/Untitled_design__4_.svg",
} as const;

export type TreeAssetName = keyof typeof TREE_ASSETS;

export type KeyedTree = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

// For an opaque black-on-white source: a soft luminance ramp rather than a
// hard threshold, so the needle edges — which are all antialiased grey —
// survive keying instead of going crunchy. Anything lighter than KEY_HIGH
// (including the light grey ground shadow some of the source art carries)
// drops out completely.
const KEY_LOW = 0.16;
const KEY_HIGH = 0.62;

// Vector sources are rasterised to at least this long edge, so a small nominal
// viewBox still yields enough detail to downsample from at 4K.
const MIN_RASTER_EDGE = 1920;

const keyedCache = new Map<string, Promise<KeyedTree>>();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load tree asset: ${src}`));
    image.src = src;
  });

const keyToAlpha = async (src: string): Promise<KeyedTree> => {
  const image = await loadImage(src);

  // An SVG carries its own alpha and can be rasterised at whatever size we
  // ask for; a PNG is used at its native size so it is never resampled twice.
  const natural = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = natural < MIN_RASTER_EDGE ? MIN_RASTER_EDGE / natural : 1;

  const raw = document.createElement("canvas");
  raw.width = Math.round(image.naturalWidth * scale);
  raw.height = Math.round(image.naturalHeight * scale);
  const rawCtx = raw.getContext("2d", { willReadFrequently: true });
  if (!rawCtx) throw new Error("2d context unavailable");
  rawCtx.drawImage(image, 0, 0, raw.width, raw.height);

  const pixels = rawCtx.getImageData(0, 0, raw.width, raw.height);
  const data = pixels.data;

  // Decide how to read the source. A traced SVG arrives with real alpha and a
  // transparent ground; a supplied PNG is opaque black on white and needs the
  // luminance ramp. Sample sparsely — checking only the corners would be
  // fooled by artwork that runs to the edge of the frame.
  let transparent = 0;
  let sampled = 0;
  for (let i = 3; i < data.length; i += 4 * 64) {
    if (data[i] < 250) transparent++;
    sampled++;
  }
  const hasAlpha = transparent > sampled * 0.02;

  let minX = raw.width;
  let minY = raw.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      const i = (y * raw.width + x) * 4;
      let alpha: number;
      if (hasAlpha) {
        alpha = data[i + 3] / 255;
      } else {
        const lum =
          (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
          255;
        alpha = (KEY_HIGH - lum) / (KEY_HIGH - KEY_LOW);
        alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
      }
      // Silhouettes are pure black with no interior detail — the shape is the
      // whole point, and it is what makes the stars pop.
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(alpha * 255);
      if (alpha > 0.5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  rawCtx.putImageData(pixels, 0, 0);

  if (maxX < 0) {
    return { canvas: raw, width: raw.width, height: raw.height };
  }

  // Crop to the artwork's own bounds so placement is driven by the tree, not
  // by however much padding the source file happens to carry.
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  const cropCtx = cropped.getContext("2d");
  if (!cropCtx) throw new Error("2d context unavailable");
  cropCtx.drawImage(raw, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return { canvas: cropped, width: cropW, height: cropH };
};

export const loadKeyedTree = (name: TreeAssetName): Promise<KeyedTree> => {
  const src = staticFile(TREE_ASSETS[name]);
  const cached = keyedCache.get(src);
  if (cached) return cached;
  const promise = keyToAlpha(src);
  keyedCache.set(src, promise);
  return promise;
};

export type KeyedTrees = Record<TreeAssetName, KeyedTree>;

export const loadKeyedTrees = async (): Promise<KeyedTrees> => {
  const [single, group, bare] = await Promise.all([
    loadKeyedTree("single"),
    loadKeyedTree("group"),
    loadKeyedTree("bare"),
  ]);
  return { single, group, bare };
};

// --- Tinting ---------------------------------------------------------------

const tintCache = new Map<string, HTMLCanvasElement>();

/** Recolours a keyed silhouette, keeping its alpha. Cached per (asset, colour). */
export const tintedTree = (
  key: string,
  tree: KeyedTree,
  color: string,
): HTMLCanvasElement => {
  const cacheKey = `${key}|${color}`;
  const cached = tintCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = tree.width;
  canvas.height = tree.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(tree.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tree.width, tree.height);

  tintCache.set(cacheKey, canvas);
  return canvas;
};

// --- Layout ----------------------------------------------------------------

export type Placement = {
  asset: TreeAssetName;
  /** Trunk-base position, as fractions of frame width/height. */
  cx: number;
  baseY: number;
  /** Drawn height, as a fraction of frame height. */
  height: number;
  flip: boolean;
  rotation: number;
  swayPeriod: number;
  swayPhase: number;
  swayAmplitude: number;
};

/** The horizon under the far tier: not flat, a gentle rise toward the left. */
export const horizonAt = (u: number) =>
  HORIZON_BASE -
  HORIZON_RISE * Math.pow(1 - u, 1.6) +
  0.007 * Math.sin(u * 5.3 + 1.1) +
  0.004 * Math.sin(u * 12.7 + 0.4);

// The near tier is hand-placed — five large trees, two cropped by the frame
// edges, one noticeably taller than the rest and off-centre. Everything else
// (flip, rotation, sway) is jittered from the seed.
const NEAR_LAYOUT: { cx: number; height: number; asset: TreeAssetName }[] = [
  { cx: 0.005, height: 0.325, asset: "single" },
  { cx: 0.155, height: 0.275, asset: "single" },
  { cx: 0.33, height: 0.385, asset: "single" },
  { cx: 0.63, height: 0.295, asset: "single" },
  { cx: 0.995, height: 0.34, asset: "single" },
];

export const buildTreeline = (seed: number) => {
  const rand = mulberry32(seed + 7331);

  const near: Placement[] = NEAR_LAYOUT.map((entry, i) => ({
    asset: entry.asset,
    cx: entry.cx,
    baseY: 1.005,
    height: entry.height,
    flip: rand() > 0.5,
    // +/- 2 degrees, so no two neighbours read as the same shape.
    rotation: (rand() * 2 - 1) * 2,
    swayPeriod: SWAY_PERIODS[i % SWAY_PERIODS.length],
    swayPhase: rand(),
    swayAmplitude: SWAY_MAX_DEGREES * (0.5 + rand() * 0.5),
  }));

  // Mid tier: lifted toward #050b16 so it reads as further back.
  const mid: Placement[] = [];
  const midCount = 12;
  for (let i = 0; i < midCount; i++) {
    const u = (i + 0.5) / midCount + (rand() - 0.5) * 0.06;
    const useGroup = i === 2 || i === 6 || i === 9;
    const useBare = i === 4;
    mid.push({
      asset: useGroup ? "group" : useBare ? "bare" : "single",
      cx: u,
      baseY: 0.975 - rand() * 0.012,
      height: useGroup
        ? 0.2 + rand() * 0.035
        : useBare
          ? 0.155
          : 0.15 + rand() * 0.075,
      flip: rand() > 0.5,
      rotation: (rand() * 2 - 1) * 2,
      swayPeriod: 0,
      swayPhase: 0,
      swayAmplitude: 0,
    });
  }

  // Far tier: a low, dense, uneven ridge sitting on the horizon curve.
  const far: Placement[] = [];
  const farCount = 38;
  for (let i = 0; i < farCount; i++) {
    const u = (i + 0.5) / farCount + (rand() - 0.5) * 0.035;
    const useGroup = i % 5 === 3;
    const useBare = i === 11 || i === 24;
    far.push({
      asset: useGroup ? "group" : useBare ? "bare" : "single",
      cx: u,
      baseY: horizonAt(u) + 0.028 + rand() * 0.012,
      height: useGroup
        ? 0.075 + rand() * 0.03
        : useBare
          ? 0.06
          : 0.055 + rand() * 0.045,
      flip: rand() > 0.5,
      rotation: (rand() * 2 - 1) * 2,
      swayPeriod: 0,
      swayPhase: 0,
      swayAmplitude: 0,
    });
  }

  return { near, mid, far };
};

export const swayAngle = (placement: Placement, frame: number) => {
  if (!placement.swayPeriod) return 0;
  const phase =
    (frame / placement.swayPeriod + placement.swayPhase) * Math.PI * 2;
  return placement.swayAmplitude * Math.sin(phase);
};
