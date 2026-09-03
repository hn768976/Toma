/**
 * Offscreen-canvas plumbing shared by every layer of a canvas piece.
 *
 * `useCanvasPaint` is the important one: it draws exactly once per React
 * render (no requestAnimationFrame, no animation loop), so the picture is a
 * pure function of the frame number and `remotion render` is deterministic.
 */
import { useEffect, useRef } from "react";
import type { DependencyList, RefObject } from "react";
import { continueRender, delayRender } from "remotion";

/** A detached canvas of the given backing-store size, ready to draw into. */
export const createCanvas = (
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

/** `getContext("2d")` that throws rather than returning null. */
export const ctx2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d canvas context unavailable");
  }
  return ctx;
};

/**
 * A resource the paint pass must wait for before its first draw — in practice
 * a webfont, whose metrics the letterform layout depends on.
 */
export type PaintGate = {
  /** True once the resource is usable and painting can be synchronous. */
  ready: () => boolean;
  /** Resolves when it becomes usable. Never rejects. */
  wait: () => Promise<void>;
};

/**
 * Paints a canvas once per render.
 *
 * Returns the ref to spread onto the `<canvas>`. When a `gate` is supplied and
 * not yet open, the draw is deferred behind a `delayRender()` handle so
 * Remotion does not capture the frame before the canvas has real content.
 */
export const useCanvasPaint = (
  paint: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
  deps: DependencyList,
  gate?: PaintGate,
): RefObject<HTMLCanvasElement | null> => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = ctx2d(canvas);

    if (!gate || gate.ready()) {
      paint(ctx, canvas);
      return;
    }

    const handle = delayRender(`Waiting on canvas paint gate (${canvas.width}px)`);
    let cancelled = false;
    gate
      .wait()
      .then(() => {
        if (!cancelled) {
          paint(ctx, canvas);
        }
      })
      .catch(() => undefined)
      .then(() => continueRender(handle));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
};
