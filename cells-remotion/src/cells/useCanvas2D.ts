import { useLayoutEffect, useRef } from "react";

/**
 * Draws to a canvas exactly once per React render, synchronously before paint.
 *
 * No requestAnimationFrame and no state: the draw callback is a pure function
 * of the current frame, which is what makes `npx remotion render`
 * deterministic.
 */
export const useCanvas2D = (
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: readonly unknown[],
) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    drawRef.current(ctx);
    // The draw closure is re-read on every render; deps carry the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
};

/** A lazily-created offscreen buffer, kept for the life of the component. */
export const useBuffer = (width: number, height: number) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  if (ref.current === null) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ref.current = canvas;
  }
  return ref.current;
};
