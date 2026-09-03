import React, { useLayoutEffect, useRef } from "react";

export type Canvas2DProps = {
  width: number;
  height: number;
  /** Called once per React render, on a cleared context. */
  draw: (ctx: CanvasRenderingContext2D) => void;
  /** CSS blend mode used to composite this layer onto the ones below. */
  blend?: React.CSSProperties["mixBlendMode"];
  opaque?: boolean;
};

/**
 * A full-bleed 2D canvas layer whose backing store is exactly
 * `width` x `height` and which redraws once per React render.
 *
 * Deliberately no requestAnimationFrame and no internal state: Remotion
 * advances the frame by re-rendering, so a layout effect with no
 * dependency array is exactly "draw this frame, now, before paint".
 * Layers are stacked absolutely and combined with `blend`, which lets
 * additively-composed glow spill correctly onto the layers beneath.
 */
export const Canvas2D: React.FC<Canvas2DProps> = ({
  width,
  height,
  draw,
  blend,
  opaque,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: !opaque });
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0, 0, 0, 0)";
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
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
