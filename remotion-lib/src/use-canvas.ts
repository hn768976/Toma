import {useLayoutEffect, useRef} from "react";

/**
 * A `<canvas>` ref that runs `draw` exactly once per React render, in a layout
 * effect so the pixels are committed before the frame is captured.
 *
 * There is deliberately no dependency array and no requestAnimationFrame: in
 * Remotion the render *is* the clock, so redrawing on every render keeps each
 * frame a pure function of `useCurrentFrame()`.
 *
 * The backing store is set to `width`/`height` (the composition's native pixel
 * size); the element is stretched to 100% by the caller's CSS, which is what
 * lets a 3840x2160 buffer be previewed at any scale without re-rasterising.
 */
export const useCanvas2D = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx, canvas);
  });

  return ref;
};

/** Create a detached 2D canvas at an exact pixel size. */
export const makeCanvas = (
  width: number,
  height: number,
): {canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D} => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d", {willReadFrequently: false});
  if (!ctx) throw new Error("2D canvas context unavailable");
  return {canvas, ctx};
};
