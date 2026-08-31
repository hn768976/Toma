/**
 * One stacked canvas in the composition.
 *
 * The draw callback runs once per React render, inside a layout effect — never
 * from requestAnimationFrame, a timer or component state, so every frame is a
 * pure function of the frame number and `remotion render` is deterministic.
 */

import React, { useLayoutEffect, useRef } from "react";
import { HEIGHT, WIDTH } from "./geometry";

export type Draw = (ctx: CanvasRenderingContext2D) => void;

export const CanvasLayer: React.FC<{
  z: number;
  draw: Draw;
  /** Blend against the layers underneath. */
  blend?: React.CSSProperties["mixBlendMode"];
  /** Hide everything below this y — used to cut the field at the horizon. */
  clipBelow?: number;
  /** Lets a later layer reuse this canvas as a source image. */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}> = ({ z, draw, blend, clipBelow, canvasRef }) => {
  const ownRef = useRef<HTMLCanvasElement | null>(null);
  const ref = canvasRef ?? ownRef;

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    // The backing store is always full 4K, independent of any preview scale.
    if (canvas.width !== WIDTH || canvas.height !== HEIGHT) {
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    draw(ctx);
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: WIDTH,
        height: HEIGHT,
        zIndex: z,
        mixBlendMode: blend,
        clipPath:
          clipBelow === undefined
            ? undefined
            : `inset(0 0 ${Math.max(0, HEIGHT - clipBelow)}px 0)`,
      }}
    />
  );
};
