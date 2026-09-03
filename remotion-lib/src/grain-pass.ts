/**
 * grainPass — fine film grain, tiled from pre-generated noise.
 *
 * Per-pixel noise over a 3840x2160 surface every frame is far too slow, so a
 * small set of 256px noise tiles is generated once (deterministically, seeded
 * from Remotion's random()) and drawn as a repeating pattern. The tile choice
 * and its sub-tile offset come from the looped frame number, so the grain is
 * deterministic and repeats exactly once per loop.
 *
 * Tile pixels are bimodal (black or white) with a magnitude-driven alpha, so
 * mid-grey noise stays fully transparent and the pass adds speckle without
 * washing the blacks out with a grey haze.
 */
import { offscreen } from "./canvas";
import { rand01, seededStream } from "./random";

const TILE = 256;
const TILE_COUNT = 16;

let tiles: HTMLCanvasElement[] | null = null;

const buildTiles = (): HTMLCanvasElement[] => {
  if (tiles) {
    return tiles;
  }
  const built: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const { canvas, ctx } = offscreen(TILE, TILE);
    const image = ctx.createImageData(TILE, TILE);
    const next = seededStream(`grain-tile-${t}`);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = next();
      const value = n < 0.5 ? 0 : 255;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 255);
    }
    ctx.putImageData(image, 0, 0);
    built.push(canvas);
  }
  tiles = built;
  return built;
};

export const grainPass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  /** Frame number already reduced modulo the loop length. */
  loopedFrame: number,
  /** Grain opacity. ~0.04 is a fine, filmic amount. */
  alpha: number,
) => {
  const built = buildTiles();
  const pattern = ctx.createPattern(built[loopedFrame % built.length], "repeat");
  if (!pattern) {
    return;
  }
  const ox = Math.floor(rand01(`grain-ox-${loopedFrame}`) * TILE);
  const oy = Math.floor(rand01(`grain-oy-${loopedFrame}`) * TILE);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + TILE, height + TILE);
  ctx.restore();
};
