/** Finishing passes: bloom onto a canvas, and deterministic tiled grain. */
import { useMemo } from "react";
import { random } from "remotion";

/**
 * Additive bloom. The blur is done at half resolution and scaled back up —
 * visually identical to a full-resolution blur here, and far cheaper at 4K.
 */
export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  scene: HTMLCanvasElement,
  layers: { radius: number; alpha: number }[],
) => {
  const w = Math.max(1, Math.round(scene.width / 2));
  const h = Math.max(1, Math.round(scene.height / 2));
  const half = document.createElement("canvas");
  half.width = w;
  half.height = h;
  const hctx = half.getContext("2d")!;
  hctx.drawImage(scene, 0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const layer of layers) {
    ctx.filter = `blur(${layer.radius / 2}px)`;
    ctx.globalAlpha = layer.alpha;
    ctx.drawImage(half, 0, 0, scene.width, scene.height);
  }
  ctx.restore();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
};

/**
 * A small set of noise tiles, generated once. Each frame picks a seeded tile and
 * offset per cell, which gives moving grain without regenerating any pixels.
 */
export const useGrainTiles = (size = 512, count = 6) =>
  useMemo(() => {
    const tiles: HTMLCanvasElement[] = [];
    for (let t = 0; t < count; t++) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      const img = ctx.createImageData(size, size);
      const d = img.data;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const v = Math.round(random(`grain-${t}-${p}`) * 255);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      tiles.push(c);
    }
    return tiles;
  }, [size, count]);
