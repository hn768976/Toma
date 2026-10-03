import { mulberry32 } from "../engine/random";

// Film grain against banding: a fixed set of noise tiles generated once
// from a seed, chosen and offset by frame number. Never Math.random().
export const GRAIN_TILE = 256;
export const GRAIN_TILES = 8;
/** Amplitude in 8-bit levels: ±4 ≈ ±1.5 %. */
export const GRAIN_AMP = 4;

const rnd = mulberry32(0x5eed);
const TILE_DATA: Uint8ClampedArray[] = [];
for (let t = 0; t < GRAIN_TILES; t++) {
  const d = new Uint8ClampedArray(GRAIN_TILE * GRAIN_TILE * 4);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    // Triangular noise in [0, 2A] – mean A, removed again by the +A layer.
    const n = (rnd() + rnd()) * GRAIN_AMP;
    const v = Math.round(n);
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  TILE_DATA.push(d);
}

let tiles: HTMLCanvasElement[] | null = null;
const getTiles = () => {
  if (tiles) return tiles;
  tiles = TILE_DATA.map((d) => {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE;
    c.height = GRAIN_TILE;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(d), GRAIN_TILE, GRAIN_TILE), 0, 0);
    return c;
  });
  return tiles;
};

/**
 * Fills `ctx` (output-pixel sized) with the grain for `frame`. The canvas is
 * composited with mix-blend-mode: difference (subtracts 0..2A) and followed
 * by a constant +A plus-lighter layer, giving zero-mean ±A grain.
 */
export const drawGrain = (ctx: CanvasRenderingContext2D, frame: number) => {
  const t = getTiles()[frame % GRAIN_TILES];
  const ox = (frame * 97) % GRAIN_TILE;
  const oy = (frame * 61) % GRAIN_TILE;
  const pat = ctx.createPattern(t, "repeat")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, ctx.canvas.width + GRAIN_TILE, ctx.canvas.height + GRAIN_TILE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
