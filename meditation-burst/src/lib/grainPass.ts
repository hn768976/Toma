import { random } from "remotion";
import { mulberry32 } from "./mulberry32";

/**
 * Film-grain overlay.
 *
 * Building eight megapixels of fresh noise per frame is far too slow at
 * 4K, so a small set of seeded monochrome tiles is generated once and
 * then laid down as a repeating pattern, offset per frame.
 *
 * The pattern is filled in a SINGLE pass. Blitting overlapping tiles
 * individually would apply the blend twice wherever two tiles met, which
 * shows up as a grid of brighter and darker rectangles across the frame.
 *
 * Tile choice and offset are seeded on `frame % loopLength`, so the
 * grain is deterministic and frame 0 and frame `loopLength` are
 * identical.
 */

const TILE = 1024;
const TILE_COUNT = 4;

const cache = new Map<string, HTMLCanvasElement[]>();

const buildTiles = (seed: string): HTMLCanvasElement[] => {
  const hit = cache.get(seed);
  if (hit) return hit;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("grainPass: no 2d context");
    const img = ctx.createImageData(TILE, TILE);
    const rand = mulberry32(t * 7919 + 104729);
    const d = img.data;
    for (let i = 0; i < TILE * TILE; i++) {
      // Centred on mid-grey: under 'overlay' that leaves the image
      // untouched on average and only adds texture.
      const v = 128 + (rand() * 2 - 1) * 118;
      const o = i * 4;
      d[o] = v;
      d[o + 1] = v;
      d[o + 2] = v;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  cache.set(seed, tiles);
  return tiles;
};

export const grainPass = (
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    frame: number;
    loopLength: number;
    alpha: number;
    seed?: string;
  },
): void => {
  const { width, height, frame, loopLength, alpha } = opts;
  const seed = opts.seed ?? "grain";
  const tiles = buildTiles(seed);
  const f = ((frame % loopLength) + loopLength) % loopLength;

  const tile = tiles[Math.floor(random(`${seed}:t:${f}`) * TILE_COUNT) % TILE_COUNT];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const ox = Math.floor(random(`${seed}:x:${f}`) * TILE);
  const oy = Math.floor(random(`${seed}:y:${f}`) * TILE);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.translate(ox, oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(-ox, -oy, width, height);
  ctx.restore();
};
