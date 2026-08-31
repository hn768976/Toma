import {createContext, useContext, useLayoutEffect} from 'react';
import type {RefObject} from 'react';

export const CanvasRefContext =
  createContext<RefObject<HTMLCanvasElement | null> | null>(null);

/**
 * Draw into the shared canvas once per React render.
 *
 * The effect deliberately has no dependency array: it runs on every render, and
 * React runs layout effects depth-first in tree order, so the components draw
 * in the order they appear in the tree — sky first, then shells, trails and
 * burst heads over it. There is no requestAnimationFrame anywhere: a frame is
 * drawn exactly once, when React renders it.
 */
export const useDraw = (draw: (ctx: CanvasRenderingContext2D) => void) => {
  const ref = useContext(CanvasRefContext);
  useLayoutEffect(() => {
    const canvas = ref?.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.save();
    draw(ctx);
    ctx.restore();
  });
};
