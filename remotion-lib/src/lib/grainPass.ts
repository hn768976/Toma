/**
 * Fine film grain.
 *
 * A small pool of seeded noise tiles is generated once and cycled by frame
 * number, so the grain crawls but the sequence closes on the loop as long as
 * the pool size divides the loop length. Tiles are built from a mulberry32
 * stream seeded through Remotion's `random()`, so every worker generates byte
 * identical tiles.
 */
import { mulberry32, rand } from "./seededRandom";

export interface GrainOptions {
  /** Opacity of the grain, e.g. 0.04. */
  alpha: number;
  /** Frames per full cycle of the tile pool — must divide the loop length. */
  poolSize: number;
  /** Loop length in frames, so the tiling offset closes on the loop. */
  loopLength: number;
  /** Composite mode. "overlay" reads as film grain on a dark frame. */
  blend?: GlobalCompositeOperation;
}

export class GrainPass {
  private readonly tileSize: number;
  private readonly seed: string;
  private readonly tiles = new Map<number, HTMLCanvasElement>();

  constructor(seed = "grain", tileSize = 512) {
    this.seed = seed;
    this.tileSize = tileSize;
  }

  private tile(index: number): HTMLCanvasElement {
    const hit = this.tiles.get(index);
    if (hit) return hit;
    const size = this.tileSize;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const prng = mulberry32(Math.floor(rand(`${this.seed}-${index}`) * 2 ** 31));
    for (let i = 0; i < data.length; i += 4) {
      // Two samples averaged: a tighter distribution around mid grey reads as
      // fine grain rather than salt and pepper.
      const v = 128 + (prng() + prng() - 1) * 118;
      const c = v < 0 ? 0 : v > 255 ? 255 : v;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.tiles.set(index, canvas);
    return canvas;
  }

  apply(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: number,
    opts: GrainOptions,
  ): void {
    const tile = this.tile(
      ((frame % opts.poolSize) + opts.poolSize) % opts.poolSize,
    );
    const prevOp = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    ctx.filter = "none";
    ctx.globalCompositeOperation = opts.blend ?? "overlay";
    ctx.globalAlpha = opts.alpha;
    const size = this.tileSize;
    // Offset the tiling so the pattern drifts. Whole numbers of tile widths
    // per loop, so frame 0 and frame `loopLength` land on the same offset.
    const t = frame / opts.loopLength;
    const ox = -Math.round(t * size * 3) % size;
    const oy = -Math.round(t * size * 5) % size;
    for (let y = oy - size; y < height; y += size) {
      for (let x = ox - size; x < width; x += size) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = prevOp;
  }
}
