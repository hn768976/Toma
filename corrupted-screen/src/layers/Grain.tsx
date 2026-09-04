import React, { useLayoutEffect, useRef } from "react";
import { hash, makeRng, seedOf } from "../lib/rand";

/**
 * Fine grain over the whole frame. This clip is meant to read as degraded
 * signal, so it errs towards more grain than usual.
 *
 * The tile is rebuilt every frame from a seed derived from the frame number, so
 * it is deterministic across threads and loops with everything else. Screen
 * blending keeps the grain visible in the blacks, where most of this frame is.
 */

const GRAIN = seedOf("grain");
const TILE = 512;
/**
 * Grain cell size in device pixels. Single pixel noise is pathological for
 * H.264 - it is pure entropy in every frame and blows the bitrate out to
 * something no one can deliver. Two pixel cells read the same at viewing size,
 * are more filmic, and cost a fraction of the bits.
 */
const CELL = 2;

type Props = {
  width: number;
  height: number;
  frame: number;
  pixelRatio: number;
  opacity?: number;
};

export const Grain: React.FC<Props> = ({ width, height, frame, pixelRatio, opacity = 0.62 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileRef = useRef<HTMLCanvasElement | null>(null);
  const cellRef = useRef<HTMLCanvasElement | null>(null);

  const deviceWidth = Math.round(width * pixelRatio);
  const deviceHeight = Math.round(height * pixelRatio);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    if (!tileRef.current) {
      const tile = document.createElement("canvas");
      tile.width = TILE;
      tile.height = TILE;
      tileRef.current = tile;
    }
    if (!cellRef.current) {
      const cells = document.createElement("canvas");
      cells.width = TILE / CELL;
      cells.height = TILE / CELL;
      cellRef.current = cells;
    }
    const tile = tileRef.current;
    const cells = cellRef.current;
    const tctx = tile.getContext("2d");
    const cctx = cells.getContext("2d");
    if (!tctx || !cctx) return;

    const rng = makeRng(Math.floor(hash(GRAIN, frame) * 0xffffffff));
    const image = cctx.createImageData(cells.width, cells.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      // Mostly dark with occasional bright specks; slight per channel spread so
      // it reads as sensor noise rather than a grey wash.
      const v = Math.pow(rng(), 3) * 40;
      data[i] = v * (0.85 + rng() * 0.3);
      data[i + 1] = v * (0.85 + rng() * 0.3);
      data[i + 2] = v * (0.85 + rng() * 0.3);
      data[i + 3] = 255;
    }
    cctx.putImageData(image, 0, 0);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(cells, 0, 0, TILE, TILE);

    const pattern = ctx.createPattern(tile, "repeat");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, deviceWidth, deviceHeight);
    if (!pattern) return;
    // Shift the tile every frame so its edges never settle into a visible grid.
    // Offsets stay on the cell grid so the grain never resamples to mush.
    const ox = Math.floor(hash(GRAIN, frame, 1) * (TILE / CELL)) * CELL;
    const oy = Math.floor(hash(GRAIN, frame, 2) * (TILE / CELL)) * CELL;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, deviceWidth + TILE, deviceHeight + TILE);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });

  return (
    <canvas
      ref={canvasRef}
      width={deviceWidth}
      height={deviceHeight}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        mixBlendMode: "screen",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
