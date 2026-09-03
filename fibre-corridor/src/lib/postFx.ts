// Vendored from remotion-lib (see its CATALOG.md). Keep in sync with
// the library copy; this project ships standalone, so the file lives here.
import { makeBuffer, type Ctx } from "./canvas";
import { rgba, type Rgb } from "./colour";

/**
 * Whole-frame finishing passes. All palette-agnostic: colours come in as
 * parsed values, nothing is hardcoded.
 */

export type BloomBuffers = {
  a: HTMLCanvasElement;
  b: HTMLCanvasElement;
  wide: HTMLCanvasElement;
};

/** Allocate the scratch surfaces bloomPass needs. Do this once, not per frame. */
export const createBloomBuffers = (
  width: number,
  height: number,
  down = 4,
  wideDown = 16,
): BloomBuffers => ({
  a: makeBuffer(width / down, height / down),
  b: makeBuffer(width / down, height / down),
  wide: makeBuffer(width / wideDown, height / wideDown),
});

/**
 * Additive bloom in two levels.
 *
 * The bright pass is done by drawing the downsampled frame onto itself with
 * 'multiply', which squares every channel: dark areas fall away, highlights
 * survive. That squared image is then added back blurred at two scales — one
 * tight, one wide — which is what makes cores and points of light glow rather
 * than simply brightening the whole frame.
 */
export const bloomPass = (
  main: Ctx,
  bufs: BloomBuffers,
  width: number,
  height: number,
  opts: {
    tightAlpha: number;
    tightBlur: number;
    wideAlpha: number;
    wideBlur: number;
  },
) => {
  const a = bufs.a.getContext("2d");
  const b = bufs.b.getContext("2d");
  const w = bufs.wide.getContext("2d");
  if (!a || !b || !w) return;

  for (const c of [a, b, w]) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.filter = "none";
  }

  a.clearRect(0, 0, bufs.a.width, bufs.a.height);
  a.imageSmoothingQuality = "high";
  a.drawImage(main.canvas, 0, 0, bufs.a.width, bufs.a.height);

  b.clearRect(0, 0, bufs.b.width, bufs.b.height);
  b.drawImage(bufs.a, 0, 0);
  b.globalCompositeOperation = "multiply";
  b.drawImage(bufs.a, 0, 0);
  b.globalCompositeOperation = "source-over";

  w.clearRect(0, 0, bufs.wide.width, bufs.wide.height);
  w.imageSmoothingQuality = "high";
  w.drawImage(bufs.b, 0, 0, bufs.wide.width, bufs.wide.height);

  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = "lighter";
  main.imageSmoothingEnabled = true;
  main.imageSmoothingQuality = "high";

  main.globalAlpha = opts.tightAlpha;
  main.filter = `blur(${opts.tightBlur}px)`;
  main.drawImage(bufs.b, 0, 0, width, height);

  main.globalAlpha = opts.wideAlpha;
  main.filter = `blur(${opts.wideBlur}px)`;
  main.drawImage(bufs.wide, 0, 0, width, height);

  main.filter = "none";
  main.globalAlpha = 1;
  main.globalCompositeOperation = "source-over";
};

/** A radial darkening toward the frame's corners, in a colour of your choice. */
export const vignettePass = (
  ctx: Ctx,
  width: number,
  height: number,
  colour: Rgb,
  strength: number,
) => {
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.3,
    width / 2,
    height / 2,
    width * 0.72,
  );
  g.addColorStop(0, rgba(colour, 0));
  g.addColorStop(0.6, rgba(colour, strength * 0.4));
  g.addColorStop(1, rgba(colour, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

/**
 * Build a set of grey noise tiles once. Cycling a small set of tiles with a
 * per-frame offset is far cheaper than generating full-frame noise, and it
 * closes exactly on a loop whose length is a multiple of the tile count.
 *
 * @param rand  deterministic 0..1 source, called with the pixel's index
 */
export const createGrainTiles = (
  count: number,
  size: number,
  rand: (tile: number, index: number) => number,
): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const c = makeBuffer(size, size);
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rand(t, i) - 0.5) * 235;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/** Tile one grain tile across the frame in 'overlay' at a low alpha. */
export const grainPass = (
  ctx: Ctx,
  tile: HTMLCanvasElement,
  width: number,
  height: number,
  alpha: number,
  offsetX: number,
  offsetY: number,
) => {
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  for (let x = -offsetX; x < width; x += tile.width) {
    for (let y = -offsetY; y < height; y += tile.height) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};
