import { useMemo } from "react";
import { CANVAS_H, CANVAS_W, HALF_SCALE } from "./layout";
import type { Depth } from "./variants";

/**
 * A depth bucket. `scale` lets callers keep drawing in 4K world coordinates
 * even when the underlying store is half resolution.
 */
export type Layer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
};

export type Buffers = {
  near: Layer;
  mid: Layer;
  far: Layer;
  /** Scratch targets the mid/far blurs land in, so each buffer blurs once. */
  midBlur: Layer;
  farBlur: Layer;
};

export const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d canvas context unavailable");
  }
  return ctx;
};

const makeLayer = (scale: number): Layer => {
  const canvas = makeCanvas(CANVAS_W * scale, CANVAS_H * scale);
  return { canvas, ctx: context2d(canvas), scale };
};

export const useBuffers = (): Buffers =>
  useMemo(
    () => ({
      near: makeLayer(1),
      mid: makeLayer(HALF_SCALE),
      far: makeLayer(HALF_SCALE),
      midBlur: makeLayer(HALF_SCALE),
      farBlur: makeLayer(HALF_SCALE),
    }),
    [],
  );

export const clearLayer = (layer: Layer) => {
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  layer.ctx.globalAlpha = 1;
  layer.ctx.globalCompositeOperation = "source-over";
  layer.ctx.filter = "none";
  layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
};

/**
 * Puts a layer's context into 4K world coordinates with the ambient camera
 * drift already applied, and returns the context ready to draw into.
 */
export const beginWorld = (layer: Layer, drift: { x: number; y: number }) => {
  const { ctx, scale } = layer;
  ctx.setTransform(scale, 0, 0, scale, drift.x * scale, drift.y * scale);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "none";
  return ctx;
};

export const layerFor = (buffers: Buffers, depth: Depth): Layer =>
  depth === "near" ? buffers.near : depth === "mid" ? buffers.mid : buffers.far;
