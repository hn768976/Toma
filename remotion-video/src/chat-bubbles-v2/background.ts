import { random } from "remotion";
import {
  BG_BASE,
  BG_DISC,
  DISC_CENTER_X,
  DISC_CENTER_Y,
  DISC_DRIFT,
  DISC_RADIUS,
  DURATION_IN_FRAMES,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  WIDTH,
} from "./constants";

const TAU = Math.PI * 2;

/**
 * A flat azure ground with one large soft disc sitting on it. The disc is
 * *deeper* than the ground rather than lighter — sampling the reference put the
 * centre at #3784F0 against a #448AEA field, less red and green but more blue.
 *
 * Its centre travels a small closed ellipse over the loop, so it is exactly
 * back where it started at frame 240.
 */
export const drawBackground = (ctx: CanvasRenderingContext2D, frame: number) => {
  ctx.fillStyle = BG_BASE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const t = (frame / DURATION_IN_FRAMES) * TAU;
  const cx = WIDTH * DISC_CENTER_X + Math.cos(t) * DISC_DRIFT;
  const cy = HEIGHT * DISC_CENTER_Y + Math.sin(t) * DISC_DRIFT * 0.6;
  const radius = WIDTH * DISC_RADIUS;

  // Held flat well past halfway, then a long falloff — the reference disc has a
  // soft but definite edge, which a plain centre-to-edge ramp does not give.
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  disc.addColorStop(0, BG_DISC);
  disc.addColorStop(0.68, BG_DISC);
  disc.addColorStop(1, BG_BASE);

  ctx.fillStyle = disc;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

// A numeric PRNG for the grain tiles only. Calling Remotion's random() once per
// pixel would mean ~1.6M string hashes; instead its output seeds this, so the
// tiles are still fully deterministic and Math.random() is never touched.
const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildGrainTiles = (): HTMLCanvasElement[] => {
  if (typeof document === "undefined") return [];

  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < GRAIN_TILE_COUNT; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const rand = mulberry32(Math.floor(random(`v2-grain-tile-${i}`) * 0xffffff) + 1);
    const data = image.data;
    for (let p = 0; p < data.length; p += 4) {
      // 128 is neutral under "overlay", so the grain adds texture without
      // shifting overall brightness.
      const value = 128 + (rand() - 0.5) * 118;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
      data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/**
 * Grain is seeded on `frame % 240`: the tile index cycles evenly (6 divides
 * 240) and the offsets are keyed to the same wrapped frame, so the grain
 * pattern at frame 240 is byte-identical to frame 0.
 */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  tiles: HTMLCanvasElement[],
) => {
  if (tiles.length === 0) return;
  const f = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const tile = tiles[f % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;

  const offsetX = Math.floor(random(`v2-grain-x-${f}`) * GRAIN_TILE_SIZE);
  const offsetY = Math.floor(random(`v2-grain-y-${f}`) * GRAIN_TILE_SIZE);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
  ctx.restore();
};
