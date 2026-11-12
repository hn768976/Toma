import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Everything is designed in a 3840x2160 coordinate space. The backing canvas
// is sized to the device pixels Remotion actually captures (--scale sets the
// device pixel ratio), so a 720p preview paints 1280x720 pixels and a 4K
// render paints 3840x2160, from the same drawing code.
export type DrawInfo = {
  frame: number;
  W: number; // design width (3840)
  H: number; // design height (2160)
  s: number; // device pixels per design unit
  pw: number; // backing width in device pixels
  ph: number;
  canvas: HTMLCanvasElement;
};

export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;

export const pixelScale = () => {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(1, dpr);
};

export const CanvasComp: React.FC<{ draw: DrawFn }> = ({ draw }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const s = pixelScale();
  const pw = Math.round(W * s);
  const ph = Math.round(H * s);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.setTransform(pw / W, 0, 0, ph / H, 0, 0);
    draw(ctx, { frame, W, H, s: pw / W, pw, ph, canvas });
  }, [frame, W, H, pw, ph, draw]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={ref} style={{ width: W, height: H, display: "block" }} />
    </AbsoluteFill>
  );
};

// Offscreen canvas helper.
export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};
