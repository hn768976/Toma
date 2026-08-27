import {rnd, rndInt} from './rng';
import {CANVAS_H, CANVAS_W} from './space';

/** Darkening at the corners. */
const VIGNETTE_STRENGTH = 0.2;
const GRAIN_ALPHA = 0.04;
const GRAIN_TILE = 256;
const GRAIN_TILES = 8;

let vignetteCache: CanvasGradient | null = null;
let vignetteCtx: CanvasRenderingContext2D | null = null;

export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  if (!vignetteCache || vignetteCtx !== ctx) {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const g = ctx.createRadialGradient(cx, cy, CANVAS_H * 0.22, cx, cy, CANVAS_W * 0.72);
    g.addColorStop(0, `rgba(0, 0, 0, 0)`);
    g.addColorStop(0.55, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH * 0.28})`);
    g.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH})`);
    vignetteCache = g;
    vignetteCtx = ctx;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = vignetteCache;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
};

let grainTiles: HTMLCanvasElement[] | null = null;

const buildGrainTiles = (): HTMLCanvasElement[] => {
  if (grainTiles) return grainTiles;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const cv = document.createElement('canvas');
    cv.width = GRAIN_TILE;
    cv.height = GRAIN_TILE;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable while building grain');
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const v = rnd(`grain:${t}:${i}`);
      const lit = v > 0.5 ? 255 : 0;
      img.data[i * 4] = lit;
      img.data[i * 4 + 1] = lit;
      img.data[i * 4 + 2] = lit;
      img.data[i * 4 + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 255);
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(cv);
  }
  grainTiles = tiles;
  return tiles;
};

/** Fine grain, re-seeded every frame on frame % 480 so the loop stays clean. */
export const drawGrain = (ctx: CanvasRenderingContext2D, frame: number) => {
  const tiles = buildGrainTiles();
  const f = ((frame % 480) + 480) % 480;
  const tile = tiles[rndInt(`grain:tile:${f}`, GRAIN_TILES)];
  const ox = Math.floor(rnd(`grain:ox:${f}`) * GRAIN_TILE);
  const oy = Math.floor(rnd(`grain:oy:${f}`) * GRAIN_TILE);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;

  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(ox, oy, CANVAS_W, CANVAS_H);
  ctx.restore();
};
