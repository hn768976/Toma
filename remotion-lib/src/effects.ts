import { random } from "remotion";
import { BLOOM_DIVISOR, type Stage } from "./canvasStage";

/**
 * Composites a blurred copy of `stage.scratch` into `dst` with additive
 * blending — the bloom. The blur happens in the reduced-resolution
 * `stage.bloom` buffer, which at 4K is the difference between a fast
 * render and an unusable one.
 *
 * `blurPx` is given in target-space pixels; it is scaled down to match.
 */
export const bloomPass = (
  dst: CanvasRenderingContext2D,
  stage: Stage,
  blurPx: number,
  alpha: number,
): void => {
  if (alpha <= 0) return;
  const ctx = stage.bloom.getContext("2d");
  if (!ctx) return;
  const { width: bw, height: bh } = stage.bloom;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, bw, bh);
  ctx.filter = `blur(${Math.max(0.1, blurPx / BLOOM_DIVISOR)}px)`;
  ctx.drawImage(stage.scratch, 0, 0, bw, bh);
  ctx.filter = "none";

  dst.save();
  dst.globalCompositeOperation = "lighter";
  dst.globalAlpha = alpha;
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = "high";
  dst.drawImage(stage.bloom, 0, 0, stage.width, stage.height);
  dst.restore();
};

/** Composites `stage.scratch` into `dst` unblurred, additively. */
export const sharpPass = (
  dst: CanvasRenderingContext2D,
  stage: Stage,
  alpha = 1,
): void => {
  dst.save();
  dst.globalCompositeOperation = "lighter";
  dst.globalAlpha = alpha;
  dst.drawImage(stage.scratch, 0, 0);
  dst.restore();
};

const TILE_SIZE = 256;
const tiles = new Map<string, HTMLCanvasElement>();

/**
 * A tile of monochrome noise, built once per browser context and cached.
 * Seeded through Remotion's random() so it is identical in every render
 * worker; Math.random() would give each worker its own grain and the
 * result would crawl.
 */
const grainTile = (seed: string): HTMLCanvasElement | null => {
  const cached = tiles.get(seed);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const { data } = image;
  for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
    const value = Math.round(random(`${seed}-${i}`) * 255);
    const p = i * 4;
    data[p] = value;
    data[p + 1] = value;
    data[p + 2] = value;
    data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  tiles.set(seed, canvas);
  return canvas;
};

/**
 * Fine film grain over the whole frame at `alpha` (~0.02). The tile is
 * offset by a frame-derived amount so the grain changes every frame
 * without ever depending on anything but the frame number.
 */
export const grainPass = (
  dst: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  alpha: number,
  seed = "countdown-grain",
): void => {
  const tile = grainTile(seed);
  if (!tile) return;
  const offsetX = Math.floor(random(`${seed}-x-${frame}`) * TILE_SIZE);
  const offsetY = Math.floor(random(`${seed}-y-${frame}`) * TILE_SIZE);

  dst.save();
  dst.globalCompositeOperation = "lighter";
  dst.globalAlpha = alpha;
  for (let y = -offsetY; y < height; y += TILE_SIZE) {
    for (let x = -offsetX; x < width; x += TILE_SIZE) {
      dst.drawImage(tile, x, y);
    }
  }
  dst.restore();
};
