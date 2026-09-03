/**
 * The canvas plumbing every visual layer shares.
 *
 * Each layer owns one <canvas> whose backing store is the real pixel grid
 * (3840x2160 for full-frame layers), stacked by DOM order. Drawing happens in
 * a layout effect — once per React render, which is once per frame, since
 * every layer's only time input is useCurrentFrame(). There is no
 * requestAnimationFrame anywhere: a frame is a pure function of its number, so
 * Remotion can render frames out of order across workers and still get
 * identical output.
 */
import { useLayoutEffect, useRef } from "react";
import { prepareLayer } from "./passes";

export type LayerDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export type LayerProps = {
  draw: LayerDraw;
  width: number;
  height: number;
  /** Position within the composition, in composition px. Defaults to 0,0. */
  left?: number;
  top?: number;
};

export const Layer: React.FC<LayerProps> = ({
  draw,
  width,
  height,
  left = 0,
  top = 0,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  // Intentionally has no dependency array: the draw closure captures this
  // frame's values, so every render repaints.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = prepareLayer(canvas, width, height);
    if (!ctx) return;
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
      }}
    />
  );
};
