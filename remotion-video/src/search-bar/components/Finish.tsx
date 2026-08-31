import React, { useMemo } from "react";
import { random } from "remotion";
import { CanvasLayer, createOffscreen } from "./CanvasLayer";
import { black, white } from "../color";
import { LOOP } from "./DataField";

const TILE = 512;
const TILE_COUNT = 6;

/**
 * The finishing pass over everything below: vignette, an optional highlight
 * lift for light mode, and fine grain.
 *
 * The grain tiles are noise, and generating a quarter of a million pixels per
 * tile through a string-seeded hash would be pointlessly slow — so each tile's
 * LCG is seeded from random() and stepped from there. Which tile is used, and
 * how it is offset, is picked per frame from random() keyed on frame % 480, so
 * the grain is identical on every render and repeats exactly on the loop.
 */
const buildTiles = (): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const canvas = createOffscreen(TILE, TILE);
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      tiles.push(canvas);
      continue;
    }
    const image = ctx.createImageData(TILE, TILE);
    const data = image.data;
    let state = (Math.floor(random(`grain:tile:${t}`) * 0xffffff) + 1) >>> 0;
    for (let i = 0; i < data.length; i += 4) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const v = state / 4294967296 - 0.5;
      const level = v > 0 ? 255 : 0;
      data[i] = level;
      data[i + 1] = level;
      data[i + 2] = level;
      data[i + 3] = Math.round(Math.abs(v) * 2 * 255);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

export const Finish: React.FC<{
  width: number;
  height: number;
  frame: number;
  vignette: number;
  lighten: boolean;
  overexpose: number;
  grain: number;
}> = ({ width, height, frame, vignette, lighten, overexpose, grain }) => {
  const overlay = useMemo(() => {
    const canvas = createOffscreen(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return canvas;
    }
    const cx = width / 2;
    const cy = height * 0.46;
    const outer = Math.sqrt(width * width + height * height) * 0.6;

    const gradient = ctx.createRadialGradient(cx, cy, outer * 0.32, cx, cy, outer);
    const tint = lighten ? white : black;
    gradient.addColorStop(0, tint(0));
    gradient.addColorStop(0.62, tint(vignette * 0.34));
    gradient.addColorStop(1, tint(vignette));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (overexpose > 0) {
      // No bloom in light mode; instead the highlights around the bar lift
      // gently towards white.
      const lift = ctx.createRadialGradient(
        cx,
        height * 0.42,
        0,
        cx,
        height * 0.42,
        width * 0.42,
      );
      lift.addColorStop(0, white(overexpose));
      lift.addColorStop(1, white(0));
      ctx.fillStyle = lift;
      ctx.fillRect(0, 0, width, height);
    }
    return canvas;
  }, [width, height, vignette, lighten, overexpose]);

  const tiles = useMemo(buildTiles, []);

  return (
    <CanvasLayer
      x={0}
      y={0}
      width={width}
      height={height}
      draw={(ctx) => {
        ctx.drawImage(overlay, 0, 0);

        const f = frame % LOOP;
        const tile = tiles[Math.floor(random(`grain:pick:${f}`) * TILE_COUNT) % TILE_COUNT];
        const offsetX = -Math.floor(random(`grain:x:${f}`) * TILE);
        const offsetY = -Math.floor(random(`grain:y:${f}`) * TILE);

        ctx.save();
        ctx.globalAlpha = grain;
        for (let y = offsetY; y < height; y += TILE) {
          for (let x = offsetX; x < width; x += TILE) {
            ctx.drawImage(tile, x, y);
          }
        }
        ctx.restore();
      }}
    />
  );
};
