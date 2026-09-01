/**
 * The finishing pass: bloom, vignette and grain. These run after every layer,
 * in raw buffer pixels rather than design units, so the look holds at any
 * buffer size.
 */

import { random } from "remotion";
import { ALPHA } from "../../variants";
import type { Ctx2D } from "./utils";

/**
 * Moderate bloom. The glow buffer holds only the three line series and the
 * counter numerals; it is blurred twice — once tight, once wide — and added
 * back over the frame. Two radii read as a real lens halo; one reads as a
 * smudge.
 */
export const applyBloom = (ctx: Ctx2D, glowCanvas: HTMLCanvasElement, scale: number): void => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";

  ctx.filter = `blur(${(9 * scale).toFixed(2)}px)`;
  ctx.globalAlpha = 0.5;
  ctx.drawImage(glowCanvas, 0, 0);

  ctx.filter = `blur(${(32 * scale).toFixed(2)}px)`;
  ctx.globalAlpha = 0.34;
  ctx.drawImage(glowCanvas, 0, 0);

  ctx.filter = "none";
  ctx.restore();
};

/** ~18% at the corners, clean through the middle two-thirds. */
export const applyVignette = (ctx: Ctx2D, width: number, height: number): void => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, outer * 0.42, cx, cy, outer);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.72, `rgba(0, 0, 0, ${ALPHA.vignette * 0.42})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${ALPHA.vignette})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const GRAIN_TILE = 256;
let grainTile: HTMLCanvasElement | null = null;

/**
 * One seeded monochrome noise tile, built once and reused. Per frame it is
 * offset by a deterministic amount so the grain crawls instead of sitting
 * still, without ever depending on wall-clock time.
 */
const getGrainTile = (): HTMLCanvasElement => {
  if (grainTile) return grainTile;
  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_TILE;
  canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the grain tile");
  const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    const level = Math.round(random(`grain-${i}`) * 255);
    image.data[i * 4] = level;
    image.data[i * 4 + 1] = level;
    image.data[i * 4 + 2] = level;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return canvas;
};

export const applyGrain = (ctx: Ctx2D, width: number, height: number, frame: number): void => {
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = ALPHA.grain;
  ctx.globalCompositeOperation = "overlay";
  // Deterministic per-frame walk through the tile.
  const dx = (frame * 37) % GRAIN_TILE;
  const dy = (frame * 61) % GRAIN_TILE;
  ctx.translate(-dx, -dy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + GRAIN_TILE, height + GRAIN_TILE);
  ctx.restore();
};
