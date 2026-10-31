import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type DrawEnv = {
  W: number; // composition width (3840) — all drawing uses these units
  H: number;
  dpr: number; // backing-store scale: 1/3 for a 720p render, 1 for 4K
};

export type DrawFn = (ctx: CanvasRenderingContext2D, frame: number, env: DrawEnv) => void;

// Remotion's --scale sets the page's devicePixelRatio. The canvas backing
// store follows it (capped at 1), so a 720p render rasterises at 1280x720
// and a 4K render at 3840x2160, both from the same 3840x2160 drawing code.
export const getDpr = () =>
  typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);

export const CanvasHost: React.FC<{ draw: DrawFn; background: string }> = ({
  draw,
  background,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = getDpr();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // willReadFrequently keeps the canvas on the CPU rasteriser (Skia), which is
    // far faster than a GPU canvas emulated by SwiftShader in headless Chrome.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, frame, { W, H, dpr });
  }, [frame, W, H, dpr, draw, background]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={ref}
        width={Math.round(W * dpr)}
        height={Math.round(H * dpr)}
        style={{ width: W, height: H }}
      />
    </AbsoluteFill>
  );
};

// Offscreen 2D canvas helper.
export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
};

// High-quality downscale of a full-resolution (4K-unit) texture to the
// render's backing scale, done once per texture.
export const resampleTo = (src: HTMLCanvasElement, scale: number) => {
  if (scale >= 0.999) return src;
  let cur = src;
  let s = 1;
  // Halve repeatedly, then a final step, so grain averages instead of aliasing.
  while (s * 0.5 >= scale) {
    const { c, ctx } = makeCanvas(cur.width / 2, cur.height / 2);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    s *= 0.5;
  }
  const { c, ctx } = makeCanvas(src.width * scale, src.height * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, c.width, c.height);
  return c;
};

// Fill a mask (white + alpha) with a colour or gradient, in place.
export const colorize = (
  mask: HTMLCanvasElement,
  style: string | ((ctx: CanvasRenderingContext2D) => CanvasFillStyle),
  alpha = 1,
) => {
  const { c, ctx } = makeCanvas(mask.width, mask.height);
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = typeof style === "string" ? style : style(ctx);
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
};

type CanvasFillStyle = string | CanvasGradient | CanvasPattern;
