import React, { useMemo } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { HEIGHT, WIDTH } from "../layout";
import { createOffscreen, PIXELS_PER_DEGREE } from "../geo";
import type { Palette } from "../variants";

/** Graticule spacing in degrees. */
const SPACING_DEGREES = 15;

/**
 * A regular lat/lon lattice at 15°, continued past the map's edges so it
 * rules the whole frame — ocean included — rather than stopping where the
 * continents do.
 */
const renderGrid = (color: string): HTMLCanvasElement => {
  const canvas = createOffscreen(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const step = SPACING_DEGREES * PIXELS_PER_DEGREE;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();

  for (let x = WIDTH / 2; x <= WIDTH + step; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, HEIGHT);
  }
  for (let x = WIDTH / 2 - step; x >= -step; x -= step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, HEIGHT);
  }
  for (let y = HEIGHT / 2; y <= HEIGHT + step; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(WIDTH, Math.round(y) + 0.5);
  }
  for (let y = HEIGHT / 2 - step; y >= -step; y -= step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(WIDTH, Math.round(y) + 0.5);
  }

  ctx.stroke();
  // The equator and prime meridian read a shade stronger than the rest.
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 + 0.5, 0);
  ctx.lineTo(WIDTH / 2 + 0.5, HEIGHT);
  ctx.moveTo(0, HEIGHT / 2 + 0.5);
  ctx.lineTo(WIDTH, HEIGHT / 2 + 0.5);
  ctx.stroke();

  return canvas;
};

export const GridLayer: React.FC<{ palette: Palette; dim: number }> = ({
  palette,
  dim,
}) => {
  const grid = useMemo(() => renderGrid(palette.gridLine), [palette.gridLine]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dim;
    ctx.drawImage(grid, 0, 0);
  };

  return <CanvasLayer draw={draw} />;
};
