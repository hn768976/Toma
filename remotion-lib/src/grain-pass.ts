/**
 * grainPass — fine film grain over a finished frame.
 *
 * A small set of noise tiles is built once and shared by every frame; each
 * frame picks one and offsets it, so the grain moves without regenerating
 * megapixels of noise per frame. All choices derive from the frame number
 * through Remotion's `random()`, so a render is reproducible, and the seed is
 * taken modulo `loopLength` so a looping piece loops cleanly.
 *
 * Composited with `overlay` against mid grey, which keeps it tonally neutral
 * on light and dark grounds alike.
 */
import type { Ctx } from "./canvas2d";
import { context2d, makeCanvas } from "./canvas2d";
import { rand } from "./seeded-random";

const TILE = 256;
const TILE_COUNT = 4;

let tiles: HTMLCanvasElement[] | null = null;

const getTiles = (): HTMLCanvasElement[] => {
  if (tiles) return tiles;
  const built: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t += 1) {
    const canvas = makeCanvas(TILE, TILE);
    const ctx = context2d(canvas);
    const image = ctx.createImageData(TILE, TILE);
    for (let i = 0; i < TILE * TILE; i += 1) {
      const v = Math.round(rand(`grain-${t}-${i}`) * 255);
      image.data[i * 4] = v;
      image.data[i * 4 + 1] = v;
      image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    built.push(canvas);
  }
  tiles = built;
  return built;
};

export interface GrainPassOptions {
  frame: number;
  /** Grain repeats with this period; pass the composition's duration. */
  loopLength: number;
  width: number;
  height: number;
  /** Typically 0.02–0.05. */
  alpha: number;
}

export const grainPass = (ctx: Ctx, o: GrainPassOptions): void => {
  const f = ((o.frame % o.loopLength) + o.loopLength) % o.loopLength;
  const tile = getTiles()[f % TILE_COUNT];
  const ox = -Math.floor(rand(`grain-x-${f}`) * TILE);
  const oy = -Math.floor(rand(`grain-y-${f}`) * TILE);
  const flip = rand(`grain-f-${f}`) < 0.5 ? 1 : -1;

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = o.alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(flip, 1);
  const left = flip === 1 ? 0 : -o.width;
  for (let x = left + ox; x < left + o.width; x += TILE) {
    for (let y = oy; y < o.height; y += TILE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};
