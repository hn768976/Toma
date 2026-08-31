import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "./color";
import { useCanvasLayer } from "./hooks";
import { HEIGHT, WIDTH } from "./layout";
import type { VariantConfig } from "./variants";

const GRAIN_TILE = 384;
/** Tile count and both offset periods divide 600, so the grain loops too. */
const GRAIN_TILES = 4;
const GRAIN_X_STEPS = 5;
const GRAIN_Y_STEPS = 3;

const tileCache = new Map<string, HTMLCanvasElement[]>();

/**
 * Fine grain, pre-rendered into a few seeded tiles once and then tiled per
 * frame. Generating 8.3M pixels of noise every frame would be absurd.
 */
const grainTiles = (grainHex: string): HTMLCanvasElement[] => {
  const cached = tileCache.get(grainHex);
  if (cached) {
    return cached;
  }
  const [r, g, b] = hexToRgb(grainHex);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE;
    canvas.height = GRAIN_TILE;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
      const data = image.data;
      for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = Math.floor(random(`grain-${t}-${i}`) * 256);
      }
      ctx.putImageData(image, 0, 0);
    }
    tiles.push(canvas);
  }
  tileCache.set(grainHex, tiles);
  return tiles;
};

/** Vignette and grain, over everything. */
export const Finish: React.FC<{ readonly config: VariantConfig }> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const tiles = useMemo(() => grainTiles(config.palette.grain), [config]);

  const ref = useCanvasLayer(WIDTH, HEIGHT, (ctx) => {
    const f = frame % 600;

    const vignetteRgb = hexToRgb(config.palette.vignette);
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const radius = Math.hypot(WIDTH, HEIGHT) * 0.52;
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);
    vignette.addColorStop(0, rgba(vignetteRgb, 0));
    vignette.addColorStop(0.62, rgba(vignetteRgb, config.vignetteStrength * 0.22));
    vignette.addColorStop(1, rgba(vignetteRgb, config.vignetteStrength));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const tile = tiles[f % GRAIN_TILES];
    const ox = (f % GRAIN_X_STEPS) * (GRAIN_TILE / GRAIN_X_STEPS) - GRAIN_TILE;
    const oy = (f % GRAIN_Y_STEPS) * (GRAIN_TILE / GRAIN_Y_STEPS) - GRAIN_TILE;
    ctx.globalAlpha = config.grainAlpha;
    for (let x = ox; x < WIDTH; x += GRAIN_TILE) {
      for (let y = oy; y < HEIGHT; y += GRAIN_TILE) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}
    />
  );
};
