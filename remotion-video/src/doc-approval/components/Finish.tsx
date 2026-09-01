import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import {
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_HEIGHT,
  GRAIN_TILE_WIDTH,
  HEIGHT,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "../layout";
import { grainTileIndex, loopFrame } from "../motion";
import { createOffscreen, rand } from "../util";

/**
 * Pre-baked noise tiles. Seeding every pixel of a 4K frame per frame would be
 * far too slow, so a small set of tiles is generated once and cycled; the
 * count divides the loop length, so frame 600 shows frame 0's tile again.
 */
const buildGrainTiles = (): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = createOffscreen(GRAIN_TILE_WIDTH, GRAIN_TILE_HEIGHT);
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) continue;
    const image = ctx.createImageData(GRAIN_TILE_WIDTH, GRAIN_TILE_HEIGHT);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = rand(`grain-${t}-${i}`);
      const value = n < 0.5 ? 0 : 255;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = Math.round(Math.abs(n * 2 - 1) * 255);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/** Vignette and fine grain, sitting above everything and outside the shake. */
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiles = useMemo(buildGrainTiles, []);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const vignette = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.32,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.68,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.6, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH * 0.42})`);
    vignette.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const loop = loopFrame(frame);
    const tile = tiles[grainTileIndex(frame)];
    if (!tile) return;
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return;
    const offsetX = Math.floor(rand(`grain-x-${loop}`) * GRAIN_TILE_WIDTH);
    const offsetY = Math.floor(rand(`grain-y-${loop}`) * GRAIN_TILE_HEIGHT);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = GRAIN_ALPHA;
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = pattern;
    ctx.fillRect(-offsetX, -offsetY, WIDTH, HEIGHT);
    ctx.restore();
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
    />
  );
};
