import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFontsReady } from "./fonts";
import { backingSize } from "./scale";

let halo: HTMLCanvasElement | null = null;
const haloCanvas = (w: number, h: number) => {
  if (!halo) halo = document.createElement("canvas");
  if (halo.width !== w || halo.height !== h) {
    halo.width = w;
    halo.height = h;
  }
  return halo;
};

export type CanvasDraw = (
  ctx: CanvasRenderingContext2D,
  backingW: number,
  backingH: number,
  frame: number,
) => void;

/**
 * A full-frame Canvas 2D look. The canvas is cleared to exact black and
 * redrawn from scratch every frame, from the frame number alone.
 */
/**
 * `halo`: strength of a faint soft glow added around the line art (a blurred
 * copy of the frame, added on top). It only brightens pixels near strokes, so
 * empty background stays exactly black.
 */
export const CanvasLook: React.FC<{ draw: CanvasDraw; halo?: number }> = ({ draw, halo = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const fontsReady = useFontsReady();
  const size = useMemo(() => backingSize(width, height), [width, height]);

  useLayoutEffect(() => {
    if (!fontsReady) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size.w, size.h);
    draw(ctx, size.w, size.h, frame);
    if (halo > 0) {
      const off = haloCanvas(size.w, size.h);
      const octx = off.getContext("2d")!;
      octx.globalCompositeOperation = "copy";
      octx.filter = `blur(${(1.6 * size.w) / 1280}px)`;
      octx.drawImage(canvas, 0, 0);
      octx.filter = "none";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = halo;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }, [draw, fontsReady, frame, size, halo]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={ref}
        width={size.w}
        height={size.h}
        style={{ position: "absolute", left: 0, top: 0, width, height }}
      />
    </AbsoluteFill>
  );
};
