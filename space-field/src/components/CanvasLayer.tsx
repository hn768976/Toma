import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";

/**
 * A full-frame canvas that redraws once per React render — and therefore once
 * per frame, since Remotion re-renders the tree for every frame it captures.
 * There is no requestAnimationFrame and no state anywhere in this project: the
 * `draw` callback is handed the frame it should paint and nothing else.
 *
 * The canvas backing store is always the full composition size (3840x2160), so
 * rendering with `--scale` downsamples a true 4K draw rather than drawing small.
 */
export const CanvasLayer: React.FC<{
  readonly draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void;
  readonly blend?: React.CSSProperties["mixBlendMode"];
}> = ({ draw, blend }) => {
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // No dependency array: this runs on every render, which is every frame.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: blend,
      }}
    />
  );
};

/** Creates an offscreen canvas once and keeps it for the life of the layer. */
export const makeOffscreen = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};
