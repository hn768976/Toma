import React, { useMemo } from "react";
import { AbsoluteFill, random } from "remotion";
import { useCanvas2D } from "./useCanvas2D";
import { LOOP_FRAMES, type Variant } from "./variants";

const TILE = 512;
/** 450 is divisible by 6, so the tile cycle closes with the loop. */
const TILE_COUNT = 6;

/**
 * Deterministic 32-bit noise, seeded from Remotion's random() so the grain is
 * identical on every render. Filling 1.5M pixels through random() itself would
 * cost seconds per mount; this keeps it to a few milliseconds.
 */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildTiles = () => {
  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      continue;
    }
    const image = ctx.createImageData(TILE, TILE);
    const data = image.data;
    const rand = mulberry32(Math.floor(random(`grain-tile-${i}`) * 2 ** 31));
    for (let p = 0; p < data.length; p += 4) {
      // Half the specks lift, half sink, so the grain averages out instead of
      // washing the frame toward grey.
      const value = rand() < 0.5 ? 0 : 255;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
      data[p + 3] = Math.floor(rand() * 256);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/**
 * Fine grain at the variant's alpha (~3%), reseeded every frame off
 * frame % 450 so it never repeats within the loop and matches frame 0 again at
 * the end of it.
 */
export const GrainPass: React.FC<{
  variant: Variant;
  loopFrame: number;
  width: number;
  height: number;
}> = ({ variant, loopFrame, width, height }) => {
  const tiles = useMemo(buildTiles, []);

  const ref = useCanvas2D(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const tile = tiles[loopFrame % TILE_COUNT];
      if (!tile) {
        return;
      }
      const pattern = ctx.createPattern(tile, "repeat");
      if (!pattern) {
        return;
      }
      const ox = Math.floor(random(`grain-x-${loopFrame % LOOP_FRAMES}`) * TILE);
      const oy = Math.floor(random(`grain-y-${loopFrame % LOOP_FRAMES}`) * TILE);
      ctx.globalAlpha = variant.grainAlpha;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width + TILE, height + TILE);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    },
    [tiles, loopFrame, variant, width, height],
  );

  return (
    <AbsoluteFill>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
