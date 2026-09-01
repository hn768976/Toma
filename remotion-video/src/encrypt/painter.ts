import { useMemo } from "react";

/**
 * A tiny ordered painter.
 *
 * Each visual component registers one draw callback during its React render;
 * the composition paints them in `order` from a single layout effect once the
 * whole tree has rendered. That keeps the components separate while the canvas
 * still receives one deterministic, correctly z-ordered pass per frame.
 *
 * Registration is keyed by id, so a double render (React strict mode) replaces
 * a layer rather than drawing it twice.
 */
export type LayerFn = () => void;

export class Painter {
  private readonly layers = new Map<string, { order: number; fn: LayerFn }>();

  register(id: string, order: number, fn: LayerFn): void {
    this.layers.set(id, { order, fn });
  }

  unregister(id: string): void {
    this.layers.delete(id);
  }

  paint(): void {
    [...this.layers.values()]
      .sort((x, y) => x.order - y.order)
      .forEach((l) => l.fn());
  }
}

/** Draw order. Lower numbers are painted first. */
export const LAYER = {
  backdrop: 10,
  panels: 20,
  dialog: 30,
  icon: 40,
  progressBar: 50,
  /** The composition flattens the depth buffers onto the visible canvas. */
  composite: 100,
  flash: 110,
  finish: 200,
} as const;

export const usePainter = (): Painter => useMemo(() => new Painter(), []);
