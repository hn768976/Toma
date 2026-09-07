import React, { useLayoutEffect } from "react";
import { CONFIG } from "./config";
import { compositeBuffer, createBuffer, paintElements } from "./draw";
import type { PassProps } from "./passes";

/**
 * Bloom over the elements sitting in the focus band. Only the sharp, bright
 * marks are collected, then the same buffer is composited back twice — a
 * tight core glow and a wide halo — so the in-focus data reads as genuinely
 * hot rather than merely bright.
 *
 * The crisp marks themselves are already drawn by <ElementField />; this pass
 * adds only the glow around them.
 */
export const FocusPass: React.FC<PassProps> = ({ canvasRef, scene }) => {
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (scene.bloom.length === 0) return;

    const { padding } = scene;
    const buffer = createBuffer(scene.width + padding * 2, scene.height + padding * 2);
    const bufferCtx = buffer.getContext("2d");
    if (!bufferCtx) return;

    // No bokeh rim here: these marks are in focus, and the rim only exists to
    // survive a heavy blur.
    paintElements(bufferCtx, scene.bloom, 0, padding);

    for (const pass of CONFIG.bloom.passes) {
      compositeBuffer(ctx, buffer, pass.blur * scene.scale, padding, pass.alpha);
    }
  }, [canvasRef, scene]);

  return null;
};
