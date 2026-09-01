/**
 * grainPass.ts — deterministic film grain.
 *
 * WHAT IT DOES
 *   Overlays animated noise on the canvas, by generating one small noise
 *   tile and repeating it with a per-frame offset.
 *
 * WHAT IT IS FOR
 *   Breaking up the banding that appears in any large smooth gradient
 *   (skies, vignettes, glows) once it is encoded to h264, and giving
 *   synthetic footage the texture that makes it sit next to real footage.
 *   A little grain hides a lot of compression.
 *
 * WHY A TILE INSTEAD OF PER-PIXEL NOISE
 *   Filling a full-frame ImageData with fresh noise is ~8.3 million
 *   writes per frame at 4K, which dominates render time. A 256px tile is
 *   65k writes, generated once, then blitted. The repeat is invisible
 *   because grain has no structure to recognise, and the per-frame offset
 *   stops the tile boundary from ever settling in one place.
 *
 * PARAMETERS
 *   ctx         destination 2D context
 *   width,      composition size in px
 *   height
 *   frame       current frame; drives the tile offset so grain crawls
 *   seed        integer; same seed + frame => identical grain. Default 1.
 *   intensity   0..1 opacity of the grain layer. Default 0.06. Above
 *               ~0.15 it stops reading as film and starts reading as a
 *               broken codec.
 *   tileSize    px. Default 256. Powers of two blit fastest.
 *   grainScale  px per noise cell. Default 1 (finest). 2-3 gives the
 *               coarser grain of a pushed high-ISO stock.
 *   blendMode   Default "overlay": lightens lights and darkens darks,
 *               preserving mid-tones. "soft-light" is subtler,
 *               "lighter" only ever adds and will lift your blacks.
 *   tint        optional Color. Omit for neutral monochrome grain.
 *
 * GOTCHA
 *   Grain must be applied at OUTPUT resolution, after everything else and
 *   after any upscale. Grain that is itself scaled up is just blur, and
 *   grain applied before a blur pass is erased by it. This should be the
 *   last thing your frame does.
 *
 * CACHING
 *   The tile is rebuilt on every call. If profiling says that matters,
 *   hoist it: call `makeGrainTile` yourself inside a useMemo keyed on
 *   (seed, tileSize, grainScale, tint) and pass the result in as `tile`.
 *
 * USAGE
 *   grainPass({ ctx, width, height, frame, seed: 3, intensity: 0.07 });
 */

import type { Color } from "../types";
import { makeRng } from "../random/seededRandom";

export type GrainTileOptions = {
  seed?: number;
  tileSize?: number;
  grainScale?: number;
  tint?: Color;
};

/**
 * Builds one square tile of seeded monochrome noise. Returns null when
 * there is no DOM (SSR); callers should treat that as "skip the pass".
 */
export const makeGrainTile = ({
  seed = 1,
  tileSize = 256,
  grainScale = 1,
  tint,
}: GrainTileOptions = {}): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;

  const cells = Math.max(1, Math.floor(tileSize / Math.max(1, grainScale)));
  const canvas = document.createElement("canvas");
  canvas.width = cells;
  canvas.height = cells;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(cells, cells);
  const rng = makeRng(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(rng() * 256);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  if (tint) {
    // Multiply keeps the noise structure and pulls it toward the tint.
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, cells, cells);
    ctx.globalCompositeOperation = "source-over";
  }
  return canvas;
};

export type GrainPassOptions = GrainTileOptions & {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  intensity?: number;
  blendMode?: GlobalCompositeOperation;
  /** Pre-built tile from makeGrainTile, to avoid rebuilding per frame. */
  tile?: HTMLCanvasElement | null;
};

export const grainPass = ({
  ctx,
  width,
  height,
  frame,
  seed = 1,
  intensity = 0.06,
  tileSize = 256,
  grainScale = 1,
  tint,
  blendMode = "overlay",
  tile,
}: GrainPassOptions): void => {
  if (intensity <= 0) return;
  const grain = tile ?? makeGrainTile({ seed, tileSize, grainScale, tint });
  if (!grain) return;

  // Offset the tile by a seeded amount each frame so the seam never
  // settles. Derived from `frame` so it stays pure and frame-addressable.
  const jump = makeRng(seed + frame * 7919);
  const offsetX = -Math.floor(jump() * tileSize);
  const offsetY = -Math.floor(jump() * tileSize);

  const previousAlpha = ctx.globalAlpha;
  const previousOp = ctx.globalCompositeOperation;

  ctx.globalAlpha = intensity;
  ctx.globalCompositeOperation = blendMode;

  // Draw the tile at its display size, repeated to cover the frame plus
  // one tile of slack for the offset.
  for (let y = offsetY; y < height; y += tileSize) {
    for (let x = offsetX; x < width; x += tileSize) {
      ctx.drawImage(grain, x, y, tileSize, tileSize);
    }
  }

  ctx.globalAlpha = previousAlpha;
  ctx.globalCompositeOperation = previousOp;
};
