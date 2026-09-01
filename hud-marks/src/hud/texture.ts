import { random } from "remotion";

/**
 * Fine grain. A handful of tiles are built once and cycled by frame, which
 * keeps the noise alive without generating 8.3M pixels every frame.
 */
export const buildGrainTiles = (
  size: number,
  count: number,
): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(random(`grain:${t}:${i}`) * 256);
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/**
 * Fine irregular mottling for the print variant. Built at low resolution and
 * scaled up smoothly, so it reads as paper rather than as pixels. Fixed to the
 * frame — it never moves.
 */
export const buildPaperTexture = (
  w: number,
  h: number,
): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // Two octaves of seeded value noise, quantised coarsely so the
      // mottling clumps instead of reading as even static.
      const a = random(`paper:a:${Math.floor(x / 2)}:${Math.floor(y / 2)}`);
      const b = random(`paper:b:${Math.floor(x / 7)}:${Math.floor(y / 7)}`);
      const v = Math.floor((a * 0.45 + b * 0.55) * 256);
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};
