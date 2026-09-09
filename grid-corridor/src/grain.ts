/**
 * Deterministic film grain.
 *
 * The dark field and the smooth bloom band badly in H.264, so a little noise is
 * doing real work here, not decoration. Remotion renders frames out of order
 * across threads, so nothing may depend on Math.random() or on render order: the
 * tiles are generated once from a fixed seed, and the frame only chooses which
 * tile to use and how far to offset it.
 */

const TILE = 512;
const TILE_COUNT = 5;

/**
 * Per-frame tile offsets. TILE_COUNT tiles x OFFSETS entries gives 25 distinct
 * grain fields, and 25 divides 450 exactly — so the grain is periodic over the
 * loop and frame 450 really is identical to frame 0, noise included.
 */
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [173, 61],
  [59, 401],
  [311, 247],
  [421, 133],
];
const GRAIN_PERIOD = TILE_COUNT * OFFSETS.length; // 25

/** xorshift32 — same sequence on every thread, every run. */
const makeRng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
};

let tiles: HTMLCanvasElement[] | null = null;

const buildTiles = (): HTMLCanvasElement[] => {
  const rng = makeRng(0x9e3779b9);
  const built: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < TILE * TILE; i++) {
      d[i * 4] = 255;
      d[i * 4 + 1] = 255;
      d[i * 4 + 2] = 255;
      d[i * 4 + 3] = Math.floor(rng() * 256);
    }
    ctx.putImageData(img, 0, 0);
    built.push(c);
  }
  return built;
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  amount: number,
) => {
  if (!tiles) tiles = buildTiles();
  const slot = ((frame % GRAIN_PERIOD) + GRAIN_PERIOD) % GRAIN_PERIOD;
  const tile = tiles[slot % TILE_COUNT];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;

  // Shift the tile as well as swapping it, so the grain crawls instead of
  // sitting still.
  const [ox, oy] = OFFSETS[Math.floor(slot / TILE_COUNT)];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = amount;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + TILE, height + TILE);
  ctx.restore();
};
