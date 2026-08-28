import { random } from "remotion";
import { DEPTH, DURATION_IN_FRAMES, GRAIN_ALPHA, HEIGHT, VIGNETTE_STRENGTH, WIDTH } from "./constants";

export type Layer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Resolution of this buffer relative to the 4K frame. */
  scale: number;
  blur: number;
};

export type Buffers = {
  far: Layer;
  mid: Layer;
  near: Layer;
  accent: Layer;
  /** The glyph is the only sharp thing in frame, so it keeps full resolution. */
  glyph: Layer;
  /** Scratch at full resolution, for bloom tinting and the glitch tear. */
  scratch: Layer;
};

const createLayer = (scale: number, blur: number): Layer => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not acquire a 2D context for a depth buffer");
  return { canvas, ctx, scale, blur };
};

/**
 * Three depth buffers plus the sharp glyph. Elements are bucketed by depth
 * and each bucket is blurred exactly once, on the way onto the frame —
 * blurring per element at 4K is unusably slow.
 */
export const createBuffers = (): Buffers => ({
  far: createLayer(DEPTH.far.scale, DEPTH.far.blur),
  mid: createLayer(DEPTH.mid.scale, DEPTH.mid.blur),
  near: createLayer(DEPTH.near.scale, DEPTH.near.blur),
  accent: createLayer(DEPTH.accent.scale, DEPTH.accent.blur),
  glyph: createLayer(1, 0),
  scratch: createLayer(1, 0),
});

export const clearLayer = (layer: Layer) => {
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  layer.ctx.globalCompositeOperation = "source-over";
  layer.ctx.globalAlpha = 1;
  layer.ctx.filter = "none";
  layer.ctx.shadowBlur = 0;
  layer.ctx.shadowColor = "transparent";
  layer.ctx.setLineDash([]);
  layer.ctx.lineDashOffset = 0;
  layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
};

export const compositeLayer = (
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  options: { alpha?: number; mode?: GlobalCompositeOperation; blur?: number } = {},
) => {
  const blur = options.blur ?? layer.blur;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = options.mode ?? "lighter";
  ctx.globalAlpha = options.alpha ?? 1;
  // ctx.filter applies to the drawing operation in the destination's own
  // space, so the radius is in frame pixels whatever resolution the buffer
  // itself was drawn at.
  ctx.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : "none";
  ctx.drawImage(layer.canvas, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
};

export type GrainTiles = HTMLCanvasElement[];

/**
 * Grain is tiled from a small set of pre-rendered noise tiles: generating
 * eight million noise pixels per frame at 4K is not affordable, and the
 * tiling is invisible under a 4% alpha.
 */
export const createGrainTiles = (seed: string, count = 5, size = 384): GrainTiles => {
  const tiles: GrainTiles = [];
  for (let t = 0; t < count; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire a 2D context for a grain tile");
    const image = ctx.createImageData(size, size);
    // Seeded LCG, kicked off from Remotion's random() so the tiles are
    // reproducible across machines without Math.random().
    let state = Math.floor(random(`${seed}-grain-${t}`) * 0xffffffff) >>> 0;
    for (let i = 0; i < image.data.length; i += 4) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const value = state >>> 24;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: GrainTiles,
  frame: number,
  seed: string,
) => {
  const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const tile = tiles[loopFrame % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const ox = Math.floor(random(`${seed}-grain-x-${loopFrame}`) * tile.width);
  const oy = Math.floor(random(`${seed}-grain-y-${loopFrame}`) * tile.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH + tile.width, HEIGHT + tile.height);
  ctx.restore();
};

export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const gradient = ctx.createRadialGradient(
    WIDTH * 0.46,
    HEIGHT * 0.5,
    HEIGHT * 0.22,
    WIDTH * 0.46,
    HEIGHT * 0.5,
    HEIGHT * 0.98,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.62, `rgba(0,0,0,${(VIGNETTE_STRENGTH * 0.35).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(0,0,0,${VIGNETTE_STRENGTH.toFixed(3)})`);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
};
