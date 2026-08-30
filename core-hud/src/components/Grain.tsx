import React, { useMemo } from "react";
import { ctxOf, loopFrame, makeCanvas, rnd } from "../draw/util";
import { HudCanvas } from "./canvas";

const TILE = 256;
/** 600 is divisible by 8, so the grain cycle closes with the loop. */
const TILE_COUNT = 8;

/**
 * The only finish on the piece. No bloom, no vignette, no scanlines — just
 * enough dither at 2% to keep large black areas from banding.
 */
const buildTiles = () =>
  Array.from({ length: TILE_COUNT }, (_, t) => {
    const canvas = makeCanvas(TILE, TILE);
    const ctx = ctxOf(canvas);
    const image = ctx.createImageData(TILE, TILE);
    const data = image.data;
    for (let i = 0; i < TILE * TILE; i++) {
      const v = rnd(`grain-${t}-${i}`);
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = Math.floor(v * 255);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });

export const Grain: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height,
}) => {
  const tiles = useMemo(buildTiles, []);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const tile = tiles[loopFrame(frame) % TILE_COUNT] as HTMLCanvasElement;
    ctx.globalAlpha = 0.02;
    for (let y = 0; y < height; y += TILE) {
      for (let x = 0; x < width; x += TILE) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
