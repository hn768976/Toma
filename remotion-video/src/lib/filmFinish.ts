// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { rgba } from "./colorUtils";
import { seededStream } from "./seededRandom";

/**
 * Film finishing passes: grain and vignette.
 *
 * Both are palette-agnostic — the tint and the strength arrive as parameters —
 * and both are pure functions of a seed and a frame index, so they can be part
 * of a loop that has to close exactly.
 */

export type GrainOptions = {
  /** Edge length of one square grain tile, in px. */
  tileSize?: number;
  /** How many distinct tiles to bake and cycle between. */
  tileCount?: number;
};

/**
 * Grain tiles are baked once and then tiled with a per-frame offset. Building
 * a full 3840x2160 noise buffer every frame would dominate the render, and it
 * is unnecessary — three tiles cycled with a moving offset show no visible
 * repeat under a 5% alpha.
 */
export const bakeGrainTiles = (
  seed: string,
  opts: GrainOptions = {},
): HTMLCanvasElement[] => {
  const tileSize = opts.tileSize ?? 1024;
  const tileCount = opts.tileCount ?? 3;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < tileCount; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const img = ctx.createImageData(tileSize, tileSize);
    const data = img.data;
    const rand = seededStream(`${seed}:grain:${t}`);
    for (let i = 0; i < tileSize * tileSize; i++) {
      const v = rand();
      const o = i * 4;
      // Signed grain: half the pixels lighten, half darken.
      const level = v < 0.5 ? 0 : 255;
      data[o] = level;
      data[o + 1] = level;
      data[o + 2] = level;
      data[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255);
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/**
 * Tiles the grain over the frame at a per-frame offset. Pass a frame index
 * already reduced modulo the loop length and the grain closes with the loop:
 * the offsets are a pure function of that index, so index 0 always looks the
 * same.
 */
export const paintGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  frame: number,
  width: number,
  height: number,
  alpha: number,
): void => {
  if (tiles.length === 0) return;
  const tile = tiles[frame % tiles.length];
  const tileSize = tile.width;
  const ox = (frame * 137) % tileSize;
  const oy = (frame * 251) % tileSize;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  for (let y = -oy; y < height; y += tileSize) {
    for (let x = -ox; x < width; x += tileSize) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};

export const paintVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorHex: string,
  strength: number,
): void => {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, outer * 0.42, cx, cy, outer);
  grad.addColorStop(0, rgba(colorHex, 0));
  grad.addColorStop(0.65, rgba(colorHex, strength * 0.38));
  grad.addColorStop(1, rgba(colorHex, strength));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
