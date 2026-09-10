import { mulberry32, range, type Rng } from "./random";
import { rgbaCss, type Palette } from "./palette";

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Low-resolution value noise, upscaled with bilinear smoothing. */
const noiseLayer = (rng: Rng, cols: number, rows: number) => {
  const c = makeCanvas(cols, rows);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.floor(rng() * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/**
 * One soft vertical light shaft, suggesting a source somewhere off frame.
 * Built as a horizontal falloff masked by a vertical one, then blurred.
 */
const drawShaft = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  w: number,
  h: number,
  centre: number,
  width: number,
  alpha: number,
  lean: number,
) => {
  const layer = makeCanvas(Math.ceil(w), Math.ceil(h));
  const lctx = layer.getContext("2d") as CanvasRenderingContext2D;
  const x0 = centre * w;
  const half = width * w;

  const across = lctx.createLinearGradient(x0 - half, 0, x0 + half, 0);
  across.addColorStop(0, rgbaCss(palette.shaft, 0));
  across.addColorStop(0.5, rgbaCss(palette.shaft, 1));
  across.addColorStop(1, rgbaCss(palette.shaft, 0));
  lctx.fillStyle = across;
  lctx.setTransform(1, 0, lean, 1, -lean * h * 0.5, 0);
  lctx.fillRect(x0 - half * 2, 0, half * 4, h);
  lctx.setTransform(1, 0, 0, 1, 0, 0);

  const down = lctx.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, "rgba(0,0,0,1)");
  down.addColorStop(0.45, "rgba(0,0,0,0.5)");
  down.addColorStop(1, "rgba(0,0,0,0)");
  lctx.globalCompositeOperation = "destination-in";
  lctx.fillStyle = down;
  lctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.filter = `blur(${(w * 0.012).toFixed(1)}px)`;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
};

/**
 * Deep centre falling to near-black corners, two faint shafts, and large-scale
 * mottling so the field is never a clean gradient (which would band badly).
 */
export const buildBackground = (palette: Palette, w: number, h: number, seed: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const rng = mulberry32(seed);

  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.44,
    0,
    w * 0.5,
    h * 0.44,
    Math.hypot(w, h) * 0.62,
  );
  g.addColorStop(0, rgbaCss(palette.bgCentre, 1));
  g.addColorStop(0.36, rgbaCss(palette.bgMid, 1));
  g.addColorStop(1, rgbaCss(palette.bgEdge, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawShaft(ctx, palette, w, h, 0.41, 0.05, 0.3, 0.06);
  drawShaft(ctx, palette, w, h, 0.73, 0.1, 0.09, -0.1);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  for (const [cols, rows, alpha] of [
    [7, 4, 0.055],
    [19, 11, 0.035],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgbaCss(palette.bgCentre, 1);
    const n = noiseLayer(rng, cols, rows);
    ctx.filter = `blur(${(w * 0.01).toFixed(1)}px)`;
    ctx.drawImage(n, -w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
  }
  ctx.restore();

  return c;
};

/** Moderate vignette, laid over the elements. */
export const buildVignette = (w: number, h: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.48,
    Math.hypot(w, h) * 0.16,
    w * 0.5,
    h * 0.48,
    Math.hypot(w, h) * 0.62,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.6, "rgba(0,0,0,0.28)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
};

const GRAIN_TILE = 256;
const GRAIN_TILES = 6;

/**
 * Grain tiles, cycled by frame. Without them the dark gradient posterises into
 * visible bands once H.264 gets hold of it.
 */
export const buildGrain = (seed: number) => {
  const rng = mulberry32(seed);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = makeCanvas(GRAIN_TILE, GRAIN_TILE);
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const v = Math.floor(range(rng, 40, 255));
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

export const GRAIN_TILE_SIZE = GRAIN_TILE;
