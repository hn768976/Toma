import React, { useLayoutEffect, useRef } from "react";
import { rgba } from "../lib/color";
import { rnd, rndRange } from "../lib/rng";
import type { Palette } from "../variants";

export interface BackgroundWashProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
}

const TAU = Math.PI * 2;
const WASH_COUNT = 4;

/**
 * The flat base fill plus a few very large, very soft radial washes drifting
 * on closed paths. Stops the frame from reading as a solid colour field.
 */
export const BackgroundWash: React.FC<BackgroundWashProps> = ({
  width,
  height,
  frame,
  duration,
  palette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = rgba(palette.backgroundDeep, 1);
    ctx.fillRect(0, 0, width, height);

    const t = (frame / duration) * TAU;
    for (let i = 0; i < WASH_COUNT; i++) {
      const s = `wash-${i}`;
      const cx =
        rndRange(`${s}-x`, 0.05, 0.95) * width +
        Math.cos(t + rnd(`${s}-px`) * TAU) * 150;
      const cy =
        rndRange(`${s}-y`, 0.05, 0.95) * height +
        Math.sin(2 * t + rnd(`${s}-py`) * TAU) * 110;
      const radius = rndRange(`${s}-r`, 0.32, 0.68) * width;
      const breathe = 0.72 + 0.28 * Math.sin(t + rnd(`${s}-b`) * TAU);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, rgba(palette.backgroundWash, 0.17 * breathe));
      grad.addColorStop(0.55, rgba(palette.backgroundWash, 0.055 * breathe));
      grad.addColorStop(1, rgba(palette.backgroundWash, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
