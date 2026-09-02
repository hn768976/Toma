import { useLayoutEffect, useRef } from "react";

/**
 * Binds a fixed-size 2D canvas and runs `draw` synchronously after every
 * React render, before paint. Nothing here schedules its own frames:
 * the caller re-renders because Remotion's frame number changed, so the
 * canvas contents stay a pure function of that frame.
 */
export const useCanvas = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): React.RefObject<HTMLCanvasElement | null> => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);
    drawRef.current(ctx);
  });

  return ref;
};
