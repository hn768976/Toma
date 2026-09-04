import { staticFile } from "remotion";

/**
 * The forest is built from one tree.
 *
 * `public/trees/tree-dense-oak.svg` is a vector trace of the dense bare oak
 * silhouette (`tools/trace-svg.mjs`, from the black-on-white PNG). Tracing
 * buys two things a keyed bitmap cannot:
 *
 *  - **Real gaps.** Every enclosed space between the branches is a hole in the
 *    path, not white paint, so fog and the distant glow show through the crown
 *    instead of being blocked by it.
 *  - **Sharpness at any scale.** The near-tier trunks are drawn close to twice
 *    the frame height at 4K; rasterising the vector at the size actually
 *    needed keeps them crisp where an enlarged bitmap would go soft.
 */

export const TREE_SVG = "trees/tree-dense-oak.svg";

/** The trunk base within the artwork, as a fraction of its width. The trace is
 *  cropped tight and symmetrised about the trunk, so it is the centre. */
export const TRUNK_X = 0.5;

/**
 * Where the trunk base falls within a crop window, as a fraction of the
 * window's width. Drawing anchors on this rather than on the window's centre,
 * so an off-centre crop still stands its trunk on the ground line — otherwise
 * every trimmed tree would sit shifted sideways from where its base belongs.
 */
export const trunkFraction = (crop?: Crop) =>
  crop ? (TRUNK_X - (crop.cx - crop.w / 2)) / crop.w : TRUNK_X;

/**
 * A window onto the artwork, as fractions of its box, anchored to the bottom
 * (so the trunk base is always included). Used by the near tier, where drawing
 * a whole tree at close to twice the frame height would both bury the shot and
 * outrun the raster.
 */
export type Crop = { cx: number; w: number; h: number };

/** One rasterisation the scene needs: a colour, a pixel height, and
 *  optionally the window of the artwork to rasterise rather than all of it. */
export type TreeVariant = { color: string; height: number; crop?: Crop };

let svgSource: string | null = null;
let viewBox = { w: 1, h: 1 };
const rasterised = new Map<string, HTMLCanvasElement>();

export const variantKey = ({ color, height, crop }: TreeVariant) =>
  `${color}|${height}|${crop ? `${crop.cx},${crop.w},${crop.h}` : "full"}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

/**
 * Rasterises the trace at an explicit pixel size, in a given colour.
 *
 * The size is baked into the SVG's own width/height rather than being applied
 * at drawImage time: a browser rasterises an <img> at its intrinsic size and
 * then scales the result, so drawing a 3071px-tall SVG into a 3600px box would
 * throw away the very sharpness the vector was for.
 */
const rasterise = async ({ color, height, crop }: TreeVariant) => {
  if (!svgSource) throw new Error("prepareTrees() has not resolved yet");

  // Cropping via the viewBox rather than a source rectangle at draw time means
  // the raster covers only the window that is actually drawn — so a near-tier
  // slab is rendered at full resolution for the size of a slab, not the size
  // the whole tree would have to be to contain it.
  const vw = crop ? viewBox.w * crop.w : viewBox.w;
  const vh = crop ? viewBox.h * crop.h : viewBox.h;
  const vx = crop ? viewBox.w * (crop.cx - crop.w / 2) : 0;
  const vy = crop ? viewBox.h * (1 - crop.h) : 0;

  const width = Math.max(1, Math.round((height * vw) / vh));
  const sized = svgSource
    .replace(/viewBox="[^"]*"/, `viewBox="${vx} ${vy} ${vw} ${vh}"`)
    .replace(/width="[^"]*"/, `width="${width}"`)
    .replace(/height="[^"]*"/, `height="${height}"`)
    .replace(/fill="#000"/, `fill="${color}"`);

  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
};

let sourcePromise: Promise<void> | null = null;

/** Fetches and parses the trace once per page. */
const ensureSource = () => {
  if (!sourcePromise) {
    sourcePromise = (async () => {
      const res = await fetch(staticFile(TREE_SVG));
      svgSource = await res.text();
      const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svgSource);
      if (!box) throw new Error("Trace is missing a viewBox");
      viewBox = { w: Number(box[1]), h: Number(box[2]) };
    })();
  }
  return sourcePromise;
};

/**
 * Rasterises the trace once per variant the scene needs, before the first
 * frame is allowed through — so drawing stays synchronous and no frame pays
 * for rasterisation.
 *
 * The per-variant cache, rather than one memoised call, is what lets a page
 * render more than one palette: switching composition in the Studio asks for
 * colours that have never been rasterised, and only those are done.
 */
export const prepareTrees = async (
  variants: readonly TreeVariant[],
): Promise<void> => {
  await ensureSource();
  for (const v of variants) {
    const key = variantKey(v);
    if (!rasterised.has(key)) rasterised.set(key, await rasterise(v));
  }
};

export const getTree = (variant: TreeVariant): HTMLCanvasElement => {
  const key = variantKey(variant);
  const hit = rasterised.get(key);
  if (!hit) throw new Error(`Tree ${key} was drawn before it was prepared`);
  return hit;
};
