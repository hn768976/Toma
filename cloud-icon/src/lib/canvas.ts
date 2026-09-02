import { useLayoutEffect, useRef } from "react";

/**
 * Wires a full-frame <canvas> to a draw callback that runs exactly once per
 * React render — which, under Remotion, means exactly once per frame.
 *
 * There is deliberately no requestAnimationFrame and no dependency array: the
 * frame number arrives as a prop, React re-renders, and the layout effect
 * repaints synchronously before the browser paints. Every frame is therefore a
 * pure function of its frame number and renders identically in any order.
 *
 * The backing store is fixed at `width` x `height` regardless of the CSS size,
 * so `--scale` on a render changes the output resolution without changing what
 * is drawn.
 */
export const useCanvasDraw = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
) => {
  const ref = useRef<HTMLCanvasElement>(null);
  // Held in a ref so the effect below never needs the callback as a dependency.
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
    ctx.clearRect(0, 0, width, height);
    drawRef.current(ctx, canvas);
  });

  return ref;
};

/** A lazily-created offscreen canvas that persists across frames. */
export const useScratchCanvas = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  if (ref.current === null) ref.current = document.createElement("canvas");
  return ref.current;
};

/** Style for a full-bleed layer canvas. */
export const layerStyle = (zIndex: number, opacity = 1): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex,
  opacity,
});
