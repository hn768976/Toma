import { useLayoutEffect, useRef } from "react";

export type Draw = (ctx: CanvasRenderingContext2D) => void;

/**
 * Draws to a <canvas> exactly once per React render.
 *
 * Deliberately has NO dependency array: Remotion re-renders the tree for every
 * frame, so "once per render" is "once per frame". There is no
 * requestAnimationFrame anywhere in this project and no component state — a
 * frame's pixels are a pure function of its frame number, which is what makes
 * `npx remotion render` deterministic and lets Remotion render frames out of
 * order across workers.
 *
 * useLayoutEffect (not useEffect) so the paint lands before the browser
 * composites; Remotion screenshots after layout effects have flushed.
 */
export const useCanvasDraw = (width: number, height: number, draw: Draw) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
  });
  return ref;
};

/**
 * Renders `draw` once into a detached canvas. Wrap the call in useMemo and the
 * result is a sprite you can blit with a single drawImage per frame.
 *
 * This is the project's whole performance story: every panel's border, corner
 * ticks, label strip, grid and axis text are static, so they are rasterised
 * once at mount and blitted thereafter. Only values, bars, arcs, the sweep and
 * the centre element are redrawn per frame.
 *
 * Returns null during SSR, where there is no `document`.
 */
export const makeSprite = (
  width: number,
  height: number,
  draw: Draw,
): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx);
  return canvas;
};
