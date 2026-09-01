import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createCanvas } from "./canvas";
import {
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  VIGNETTE_FALLOFF,
  VIGNETTE_MAX_ALPHA,
  VIGNETTE_STOPS,
} from "./config";
import { rand } from "./rand";
import { rgba, type Theme } from "./theme";
import { useLoopFrame } from "./useLoopFrame";

type Props = {
  width: number;
  height: number;
  theme: Theme;
};

/**
 * Noise tiles, generated once. Making 8.3M fresh noise pixels per frame is
 * not affordable, so a small set of tiles is cycled and offset instead —
 * both driven by frame % 240, which keeps the grain seeded and looping.
 */
const buildGrainTiles = () => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILE_COUNT; t++) {
    const canvas = createCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return tiles;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      // Centred on mid-grey so the overlay blend darkens and lightens in
      // equal measure rather than just lifting the blacks.
      const pixel = i >> 2;
      const value = Math.round(rand(`grain-${t}-${pixel}`) * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/** Vignette and fine grain — the last pass over the finished frame. */
export const GrainVignette: React.FC<Props> = ({ width, height, theme }) => {
  const frame = useLoopFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tiles = useMemo(buildGrainTiles, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || tiles.length === 0) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);

    // Vignette: transparent across the middle, easing to the theme's
    // near-black at the corners. The falloff runs from dead centre on a
    // power curve rather than starting at an inner radius — a gradient
    // that begins partway out leaves a faint but real ring at that radius,
    // which is plainly visible if anyone lifts the shadows.
    const outer = Math.hypot(width, height) / 2;
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      outer,
    );
    for (let step = 0; step <= VIGNETTE_STOPS; step++) {
      const t = step / VIGNETTE_STOPS;
      gradient.addColorStop(
        t,
        rgba(
          theme.vignette,
          VIGNETTE_MAX_ALPHA * Math.pow(t, VIGNETTE_FALLOFF),
        ),
      );
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grain: one of the tiles, shifted by a seeded per-frame offset so the
    // pattern never sits still, and repeating exactly every 240 frames.
    const tile = tiles[frame % tiles.length];
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return;
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = GRAIN_ALPHA;
    ctx.save();
    ctx.translate(
      -Math.floor(rand(`grain-ox-${frame}`) * GRAIN_TILE_SIZE),
      -Math.floor(rand(`grain-oy-${frame}`) * GRAIN_TILE_SIZE),
    );
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, tiles, width, height, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
