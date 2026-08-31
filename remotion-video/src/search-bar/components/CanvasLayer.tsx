import React, { useLayoutEffect, useRef } from "react";

/**
 * One absolutely positioned canvas covering a rectangle of the composition.
 *
 * The context handed to `draw` is pre-translated into composition coordinates,
 * so every component can work in the same space regardless of how large a
 * rectangle it actually owns. The draw runs in a layout effect with no
 * dependency list: once per React render, never on a timer.
 */
export const CanvasLayer: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}> = ({ x, y, width, height, draw }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (canvas === null) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(-x, -y);
    draw(ctx);
    ctx.restore();
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
      }}
    />
  );
};

/** Rounded rectangle path; a radius of half the height gives a pill. */
export const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
};

/** An offscreen canvas at composition scale, for chrome that never changes. */
export const createOffscreen = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
