import type React from "react";
import type { Palette } from "../variants";

/**
 * How a layer composites.
 *
 *  "screen" — the normal deliverable. Layers stack onto an opaque near-black
 *             base; light is added, darkness is multiplied in. The editor
 *             screen-blends the finished clip over their footage.
 *  "alpha"  — the transparent deliverable. There is no base: light layers add
 *             both colour and alpha onto transparency, and darkening layers
 *             erase alpha instead of multiplying colour. The result can be
 *             laid over footage with no blend mode at all.
 */
export type LayerMode = "screen" | "alpha";

/**
 * Every layer draws into the one shared 4K canvas owned by <GrungeOverlay>.
 *
 * Draw order is React tree order: layout effects fire depth-first in the order
 * children appear, and all of them before the parent's. <BaseFill> is
 * therefore the first child (it clears), and the parent's own layout effect is
 * the last thing to run. Layers must not be memoised, or their effect would be
 * skipped on a frame where their props happen not to change.
 */
export type LayerBaseProps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Frame within the loop, i.e. already reduced modulo LOOP_FRAMES. */
  frame: number;
  width: number;
  height: number;
  mode: LayerMode;
  palette: Palette;
  /** 0 switches the layer off entirely. */
  intensity: number;
};

/** Resolves the shared context, or null when there is nothing to draw into. */
export const layerContext = (
  props: LayerBaseProps,
): CanvasRenderingContext2D | null => {
  if (props.intensity <= 0) return null;
  const canvas = props.canvasRef.current;
  if (!canvas) return null;
  return canvas.getContext("2d");
};
