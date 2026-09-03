/**
 * The slow drifting wash behind everything.
 *
 * Rasterised at 1/8 resolution and upscaled: it is nothing but wide smooth
 * gradients, so the full 4K backing store would be pure waste.
 */
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH, layerStyle, loopedFrame } from "./constants";
import { TAU, offscreen, rgba, useCanvas2D } from "../lib/canvas";
import { DIVISORS_OF_360, randPick, randRange } from "../lib/random";
import type { Palette } from "./variants";

const SCALE = 1 / 8;
const BLOB_COUNT = 5;

type Blob = {
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  period: number;
  phase: number;
  alpha: number;
};

const buildBlobs = (seedKey: string): Blob[] =>
  new Array(BLOB_COUNT).fill(0).map((_unused, i) => ({
    x: randRange(`${seedKey}-wash-x-${i}`, 0.05, 0.95),
    y: randRange(`${seedKey}-wash-y-${i}`, 0.05, 0.95),
    radius: randRange(`${seedKey}-wash-r-${i}`, 0.22, 0.5),
    driftX: randRange(`${seedKey}-wash-dx-${i}`, 0.02, 0.07),
    driftY: randRange(`${seedKey}-wash-dy-${i}`, 0.015, 0.05),
    // Slow, and always a whole number of cycles inside the loop.
    period: randPick(`${seedKey}-wash-p-${i}`, DIVISORS_OF_360.slice(-4)),
    phase: randRange(`${seedKey}-wash-ph-${i}`, 0, 1),
    alpha: randRange(`${seedKey}-wash-a-${i}`, 0.14, 0.34),
  }));

export const BackgroundWash: React.FC<{
  palette: Palette;
  seedKey: string;
}> = ({ palette, seedKey }) => {
  const frame = useCurrentFrame();
  const f = loopedFrame(frame);
  const blobs = useMemo(() => buildBlobs(seedKey), [seedKey]);

  const buffer = useMemo(
    () => offscreen(Math.round(WIDTH * SCALE), Math.round(HEIGHT * SCALE)),
    [],
  );

  const ref = useCanvas2D((ctx, width, height) => {
    const { ctx: bctx, canvas: bcanvas } = buffer;
    const bw = bcanvas.width;
    const bh = bcanvas.height;

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = "source-over";
    bctx.globalAlpha = 1;
    bctx.fillStyle = palette.backgroundDeep;
    bctx.fillRect(0, 0, bw, bh);

    bctx.globalCompositeOperation = "lighter";
    for (const blob of blobs) {
      const theta = TAU * (f / blob.period + blob.phase);
      // A 1:2 Lissajous is closed, so the drift returns exactly to its start.
      const cx = (blob.x + blob.driftX * Math.cos(theta)) * bw;
      const cy = (blob.y + blob.driftY * Math.sin(2 * theta)) * bh;
      const r = blob.radius * bw;
      const gradient = bctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, rgba(palette.backgroundWash, blob.alpha));
      gradient.addColorStop(0.55, rgba(palette.backgroundWash, blob.alpha * 0.3));
      gradient.addColorStop(1, rgba(palette.backgroundWash, 0));
      bctx.fillStyle = gradient;
      bctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(0, 0, width, height);
    ctx.filter = "blur(6px)";
    ctx.drawImage(bcanvas, 0, 0, width, height);
    ctx.filter = "none";
  });

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={layerStyle} />;
};
