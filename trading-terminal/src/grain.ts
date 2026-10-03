import { mulberry32 } from "./rng";

// Anti-banding grain: a fixed set of noise tiles generated once from a seeded
// PRNG, picked and offset by frame number. Signed noise of about +/-1.5% of
// full scale is split into a positive half (composited with plus-lighter) and
// a negative half (composited with difference), so the mean brightness is
// unchanged.
export const GRAIN_TILES = 8;
export const GRAIN_TILE = 128;
export const GRAIN_AMP = 0.015 * 255;

const r = mulberry32(0x6a7f31);
const tiles: Float32Array[] = Array.from({ length: GRAIN_TILES }, () => {
  const a = new Float32Array(GRAIN_TILE * GRAIN_TILE);
  // Triangular distribution in [-AMP, +AMP].
  for (let i = 0; i < a.length; i++) a[i] = (r() + r() - 1) * GRAIN_AMP;
  return a;
});

const cache = new Map<string, HTMLCanvasElement>();

const tileCanvas = (index: number, sign: 1 | -1) => {
  const key = `${index}:${sign}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = GRAIN_TILE;
  c.height = GRAIN_TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  const t = tiles[index];
  for (let i = 0; i < t.length; i++) {
    const v = Math.round(Math.max(0, sign * t[i]));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
};

/** Fill a canvas (at device resolution) with the grain for this frame. */
export const drawGrain = (canvas: HTMLCanvasElement, frame: number, sign: 1 | -1) => {
  const ctx = canvas.getContext("2d")!;
  const pattern = ctx.createPattern(tileCanvas(frame % GRAIN_TILES, sign), "repeat")!;
  const ox = (frame * 37) % GRAIN_TILE;
  const oy = (frame * 71) % GRAIN_TILE;
  ctx.setTransform(1, 0, 0, 1, -ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, canvas.width + GRAIN_TILE, canvas.height + GRAIN_TILE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
