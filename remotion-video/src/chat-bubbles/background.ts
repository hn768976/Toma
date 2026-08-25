import { random } from "remotion";
import {
  BG_DEEP,
  BG_MID,
  BG_PALE,
  DURATION_IN_FRAMES,
  GRADIENT_DRIFT,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  HIGHLIGHT_STRENGTH,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./constants";

const TAU = Math.PI * 2;

/**
 * The gradient's light region travels a small closed path over the loop, so it
 * is back where it started at frame 240. Endpoints move in opposite phase so
 * the light region actually shifts rather than the whole ramp translating.
 */
export const drawBackgroundGradient = (
  ctx: CanvasRenderingContext2D,
  frame: number,
) => {
  const t = (frame / DURATION_IN_FRAMES) * TAU;
  const dx = Math.cos(t) * GRADIENT_DRIFT;
  const dy = Math.sin(t) * GRADIENT_DRIFT;

  const gradient = ctx.createLinearGradient(
    -WIDTH * 0.1 + dx,
    -HEIGHT * 0.1 + dy,
    WIDTH * 1.05 - dx,
    HEIGHT * 1.05 - dy,
  );
  // The pale end is held well past halfway so the left side stays near-white
  // and the deep blue only arrives in the lower-right corner. A straight
  // three-stop ramp puts BG_MID across the whole centre and reads far too
  // saturated for a background plate.
  gradient.addColorStop(0, BG_PALE);
  gradient.addColorStop(0.34, "#D2E5F9");
  gradient.addColorStop(0.7, BG_MID);
  gradient.addColorStop(1, BG_DEEP);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/**
 * A gentle overexposure lift in the upper-left, as a slightly hot shot would
 * have. This is the only "light" in the piece — it is not a bloom pass and
 * nothing in the field is emissive.
 */
export const drawHighlight = (ctx: CanvasRenderingContext2D, frame: number) => {
  const t = (frame / DURATION_IN_FRAMES) * TAU;
  const cx = WIDTH * 0.16 + Math.cos(t) * GRADIENT_DRIFT * 0.8;
  const cy = HEIGHT * 0.12 + Math.sin(t) * GRADIENT_DRIFT * 0.8;

  const highlight = ctx.createRadialGradient(cx, cy, 0, cx, cy, WIDTH * 0.72);
  highlight.addColorStop(0, `rgba(255, 255, 255, ${HIGHLIGHT_STRENGTH})`);
  highlight.addColorStop(0.55, `rgba(255, 255, 255, ${HIGHLIGHT_STRENGTH * 0.3})`);
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/** Warm rather than dark — a dark vignette would fight the light-mode look. */
export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    HEIGHT * 0.25,
    cx,
    cy,
    WIDTH * 0.72,
  );
  vignette.addColorStop(0, "rgba(206, 186, 158, 0)");
  vignette.addColorStop(1, `rgba(206, 186, 158, ${VIGNETTE_STRENGTH})`);

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

// A numeric PRNG for the grain tiles only. Calling Remotion's random() once
// per pixel would mean ~1.6M string hashes; instead its output seeds this, so
// the tiles are still fully deterministic and Math.random() is never touched.
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
    const rand = mulberry32(Math.floor(random(`grain-tile-${i}`) * 0xffffff) + 1);
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

  const offsetX = Math.floor(random(`grain-x-${f}`) * GRAIN_TILE_SIZE);
  const offsetY = Math.floor(random(`grain-y-${f}`) * GRAIN_TILE_SIZE);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
  ctx.restore();
};
